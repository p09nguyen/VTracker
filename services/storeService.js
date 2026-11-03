/**
 * Valorant Store Service
 * Fetches and aggregates daily rotating offers, Night Market, Bundles, Accessory Store, and Wallet
 */

const skinCache = require('./skinCache');

const VP_CURRENCY_ID = '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741';
const KC_CURRENCY_ID = '85ca954a-41f2-ce94-9b45-8ca3dd39a00d';
const RP_CURRENCY_ID = 'e59aa87c-4cbf-517a-5983-6e81511be9b7';

class StoreService {
  /**
   * Fetch Live Storefront and Wallet for an authenticated session
   */
  async fetchLiveStore(auth) {
    const { accessToken, entitlementsToken, puuid, region = 'ap' } = auth;
    if (!accessToken || !entitlementsToken || !puuid) {
      throw new Error('Thiếu thông tin phiên đăng nhập (Access Token hoặc PUUID).');
    }

    const clientVersion = skinCache.clientVersion;
    const clientPlatform = 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';

    const commonHeaders = {
      'Authorization': 'Bearer ' + accessToken,
      'X-Riot-Entitlements-JWT': entitlementsToken,
      'X-Riot-ClientVersion': clientVersion,
      'X-Riot-ClientPlatform': clientPlatform,
      'Content-Type': 'application/json'
    };

    // 1. Fetch Storefront V3
    const storefrontUrl = `https://pd.${region}.a.pvp.net/store/v3/storefront/${puuid}`;
    const storefrontRes = await fetch(storefrontUrl, {
      method: 'POST',
      headers: commonHeaders,
      body: '{}'
    });

    if (!storefrontRes.ok) {
      const errText = await storefrontRes.text();
      console.error('[StoreService] Storefront failed:', storefrontRes.status, errText);
      if (storefrontRes.status === 400 || storefrontRes.status === 401) {
        throw new Error('Phiên đăng nhập Riot đã hết hạn (Token 1 giờ). Vui lòng đăng nhập lại để cập nhật cửa hàng.');
      }
      throw new Error(`Không thể lấy dữ liệu cửa hàng từ Riot (Status ${storefrontRes.status}).`);
    }

    const storeData = await storefrontRes.json();

    // 2. Fetch Wallet Balances
    let balances = { vp: 0, kc: 0, rp: 0 };
    try {
      const walletUrl = `https://pd.${region}.a.pvp.net/store/v1/wallet/${puuid}`;
      const walletRes = await fetch(walletUrl, {
        method: 'GET',
        headers: commonHeaders
      });
      if (walletRes.ok) {
        const walletData = await walletRes.json();
        balances = {
          vp: walletData.Balances?.[VP_CURRENCY_ID] ?? 0,
          kc: walletData.Balances?.[KC_CURRENCY_ID] ?? 0,
          rp: walletData.Balances?.[RP_CURRENCY_ID] ?? 0
        };
      }
    } catch (e) {
      console.warn('[StoreService] Could not fetch wallet balances:', e.message);
    }

    // 3. Fetch Player MMR & Rank
    let rankData = {
      tier: 0,
      tierName: 'UNRANKED',
      rankedRating: 0,
      largeIcon: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/largeicon.png',
      color: '#94a3b8',
      actName: ''
    };
    try {
      const mmrUrl = `https://pd.${region}.a.pvp.net/mmr/v1/players/${puuid}`;
      const mmrRes = await fetch(mmrUrl, {
        method: 'GET',
        headers: commonHeaders
      });
      if (mmrRes.ok) {
        const mmrJson = await mmrRes.json();
        const compQueue = mmrJson.QueueSkills?.competitive;
        const seasonalMap = compQueue?.SeasonalInfoBySeasonID || {};
        const currentAct = skinCache.getCurrentAct();
        const currentSeasonId = currentAct?.uuid;

        let tierNumber = 0;
        let rr = 0;
        let actName = currentAct?.displayName || '';

        // Strategy 1: Check Current Act in SeasonalInfoBySeasonID
        if (currentSeasonId && seasonalMap[currentSeasonId]) {
          const currentSeasonInfo = seasonalMap[currentSeasonId];
          if (currentSeasonInfo.CompetitiveTier && currentSeasonInfo.CompetitiveTier > 0) {
            tierNumber = currentSeasonInfo.CompetitiveTier;
            rr = currentSeasonInfo.RankedRating ?? 0;
            actName = currentAct?.displayName || '';
          }
        }

        // Strategy 2: If current act is not yet placed, check LatestCompetitiveUpdate
        if (tierNumber === 0 && mmrJson.LatestCompetitiveUpdate && mmrJson.LatestCompetitiveUpdate.TierAfterUpdate > 0) {
          tierNumber = mmrJson.LatestCompetitiveUpdate.TierAfterUpdate;
          rr = mmrJson.LatestCompetitiveUpdate.RankedRatingAfterUpdate ?? 0;
          const matchAct = skinCache.seasons.find(s => s.uuid === mmrJson.LatestCompetitiveUpdate.SeasonID);
          if (matchAct) actName = matchAct.displayName;
        }

        // Strategy 3: Walk backwards chronologically through Acts from newest to oldest
        if (tierNumber === 0 && skinCache.seasons && skinCache.seasons.length > 0) {
          for (const act of skinCache.seasons) {
            const sInfo = seasonalMap[act.uuid];
            if (sInfo && sInfo.CompetitiveTier && sInfo.CompetitiveTier > 0) {
              tierNumber = sInfo.CompetitiveTier;
              rr = sInfo.RankedRating ?? 0;
              actName = act.displayName;
              break; // Found the most recent season the player placed in!
            }
          }
        }

        const tierInfo = skinCache.resolveCompetitiveTier(tierNumber);
        rankData = {
          tier: tierNumber,
          tierName: tierInfo.tierName,
          rankedRating: rr,
          largeIcon: tierInfo.largeIcon,
          color: tierInfo.color,
          actName
        };

        console.log(`[StoreService] MMR resolved for player ${puuid}:`, {
          tierNumber,
          tierName: tierInfo.tierName,
          rr,
          actName
        });
      } else {
        const errText = await mmrRes.text();
        console.warn(`[StoreService] MMR request failed (status ${mmrRes.status}):`, errText);
      }
    } catch (e) {
      console.warn('[StoreService] Could not fetch MMR:', e.message);
    }

    // Process Components
    const dailyOffers = this.parseDailyOffers(storeData);
    const featuredBundles = this.parseFeaturedBundles(storeData);
    const nightMarket = this.parseNightMarket(storeData);
    const accessoryStore = this.parseAccessoryStore(storeData);

    return {
      success: true,
      mode: 'live',
      player: {
        gameName: auth.gameName || 'Agent',
        tagLine: auth.tagLine || 'VAL',
        puuid: auth.puuid,
        region: auth.region || 'ap'
      },
      wallet: balances,
      rank: rankData,
      dailyOffers,
      featuredBundles,
      nightMarket,
      accessoryStore,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Parse 4 Daily Rotating Offers
   */
  parseDailyOffers(storeData) {
    const layout = storeData.SkinsPanelLayout;
    if (!layout) return { items: [], remainingSeconds: 0 };

    const remainingSeconds = layout.SingleItemOffersRemainingDurationInSeconds || 0;
    const costMap = new Map();

    if (layout.SingleItemStoreOffers) {
      for (const offer of layout.SingleItemStoreOffers) {
        const cost = offer.Cost?.[VP_CURRENCY_ID] || Object.values(offer.Cost || {})[0] || 0;
        costMap.set(offer.OfferID, cost);
      }
    }

    const items = (layout.SingleItemOffers || []).map(itemUuid => {
      const cost = costMap.get(itemUuid) || 0;
      return skinCache.resolveSkinItem(itemUuid, cost);
    });

    return {
      items,
      remainingSeconds,
      endsAt: new Date(Date.now() + remainingSeconds * 1000).toISOString()
    };
  }

  /**
   * Parse Featured Bundles
   */
  parseFeaturedBundles(storeData) {
    const fb = storeData.FeaturedBundle;
    if (!fb) return { bundles: [], remainingSeconds: 0 };

    const bundlesRaw = fb.Bundles || (fb.Bundle ? [fb.Bundle] : []);
    const remainingSeconds = fb.BundleRemainingDurationInSeconds || bundlesRaw[0]?.DurationRemainingInSeconds || 0;

    const bundles = bundlesRaw.map(b => {
      const meta = skinCache.resolveBundle(b.DataAssetID || b.ID);
      const totalBaseCost = b.TotalBaseCost?.[VP_CURRENCY_ID] || Object.values(b.TotalBaseCost || {})[0] || 0;
      const totalDiscountedCost = b.TotalDiscountedCost?.[VP_CURRENCY_ID] || Object.values(b.TotalDiscountedCost || {})[0] || 0;
      const discountPercent = Math.round((b.TotalDiscountPercent || 0) * 100);

      // Resolve bundle items
      const items = (b.ItemOffers || []).map(offer => {
        const itemReward = offer.Rewards?.[0];
        const cost = offer.DiscountedCost?.[VP_CURRENCY_ID] || offer.BaseCost?.[VP_CURRENCY_ID] || 0;
        if (!itemReward) return null;
        return skinCache.resolveSkinItem(itemReward.ItemID, cost);
      }).filter(Boolean);

      return {
        id: b.ID,
        dataAssetId: b.DataAssetID,
        displayName: meta.displayName || 'Bộ sưu tập nổi bật',
        displayIcon: meta.displayIcon2 || meta.displayIcon || meta.verticalPromoImage,
        verticalPromoImage: meta.verticalPromoImage,
        description: meta.description,
        totalBaseCost,
        totalDiscountedCost,
        discountPercent,
        remainingSeconds: b.DurationRemainingInSeconds || remainingSeconds,
        items
      };
    });

    return {
      bundles,
      remainingSeconds,
      endsAt: new Date(Date.now() + remainingSeconds * 1000).toISOString()
    };
  }

  /**
   * Parse Night Market (BonusStore)
   */
  parseNightMarket(storeData) {
    const bs = storeData.BonusStore;
    if (!bs || !bs.BonusStoreOffers || bs.BonusStoreOffers.length === 0) {
      return {
        isActive: false,
        items: [],
        remainingSeconds: 0
      };
    }

    const remainingSeconds = bs.BonusStoreRemainingDurationInSeconds || 0;
    const items = bs.BonusStoreOffers.map(o => {
      const skinLevelUuid = o.Offer?.Rewards?.[0]?.ItemID || o.Offer?.OfferID;
      const originalCost = o.Offer?.Cost?.[VP_CURRENCY_ID] || 0;
      const discountedCost = o.DiscountCosts?.[VP_CURRENCY_ID] || 0;
      const discountPercent = o.DiscountPercent || Math.round(((originalCost - discountedCost) / (originalCost || 1)) * 100);
      const skin = skinCache.resolveSkinItem(skinLevelUuid, discountedCost);

      return {
        ...skin,
        offerId: o.BonusOfferID,
        originalCost,
        discountedCost,
        discountPercent,
        isSeen: o.IsSeen ?? true
      };
    });

    return {
      isActive: true,
      items,
      remainingSeconds,
      endsAt: new Date(Date.now() + remainingSeconds * 1000).toISOString()
    };
  }

  /**
   * Parse Kingdom Credits Accessory Store
   */
  parseAccessoryStore(storeData) {
    const acc = storeData.AccessoryStore;
    if (!acc || !acc.AccessoryStoreOffers) {
      return { items: [], remainingSeconds: 0 };
    }

    const remainingSeconds = acc.AccessoryStoreRemainingDurationInSeconds || 0;
    const items = acc.AccessoryStoreOffers.map(offerWrapper => {
      const offer = offerWrapper.Offer;
      if (!offer) return null;
      const reward = offer.Rewards?.[0];
      const cost = offer.Cost?.[KC_CURRENCY_ID] || 0;
      const itemId = reward?.ItemID || offer.OfferID;
      return skinCache.resolveAccessoryItem(itemId, cost);
    }).filter(Boolean);

    return {
      items,
      remainingSeconds,
      endsAt: new Date(Date.now() + remainingSeconds * 1000).toISOString()
    };
  }

  /**
   * Demo / Showcase Store Data with iconic skins
   */
  getDemoStore() {
    // Select popular skins for demo
    const demoSkinNames = ['Kuronami Vandal', 'Prime//2.0 Karambit', 'Reaver Operator', 'Araxys Vandal'];
    const demoItems = [];

    for (const name of demoSkinNames) {
      const found = Array.from(skinCache.skins.values()).find(s => s.displayName.toLowerCase().includes(name.toLowerCase()));
      if (found) {
        demoItems.push(skinCache.resolveSkinItem(found.uuid, 2175));
      }
    }

    // If cache not fully loaded yet, provide rich fallbacks
    if (demoItems.length === 0) {
      demoItems.push(
        {
          uuid: 'kuronami-vandal',
          displayName: 'Kuronami Vandal',
          displayIcon: 'https://media.valorant-api.com/weaponskinlevels/0c9cb545-4204-c159-f55a-dfb94cbf1a98/displayicon.png',
          tier: { name: 'Exclusive Edition', color: '#f5955b' },
          cost: 2375,
          chromas: [
            { displayName: 'Standard', displayIcon: 'https://media.valorant-api.com/weaponskinchromas/45805fe0-4fa9-6fba-e07d-2b9a7b6cfc6b/fullrender.png' },
            { displayName: 'Purple', displayIcon: 'https://media.valorant-api.com/weaponskinchromas/45805fe0-4fa9-6fba-e07d-2b9a7b6cfc6b/fullrender.png' }
          ],
          levels: [{ displayName: 'Level 4 (Finisher)' }],
          streamedVideo: 'https://media.valorant-api.com/weaponskinlevels/0c9cb545-4204-c159-f55a-dfb94cbf1a98/streamedvideo.mp4'
        },
        {
          uuid: 'reaver-operator',
          displayName: 'Reaver Operator',
          displayIcon: 'https://media.valorant-api.com/weaponskinlevels/062fec2e-4b72-f15f-f3f2-1a9235d90956/displayicon.png',
          tier: { name: 'Premium Edition', color: '#d1548d' },
          cost: 1775,
          chromas: [],
          levels: [],
          streamedVideo: 'https://media.valorant-api.com/weaponskinlevels/062fec2e-4b72-f15f-f3f2-1a9235d90956/streamedvideo.mp4'
        }
      );
    }

    // Demo Night Market cards
    const demoNightMarketItems = [
      {
        uuid: 'prime-vandal',
        displayName: 'Prime Vandal',
        displayIcon: 'https://media.valorant-api.com/weaponskinlevels/3e954546-4a41-2e21-0a6a-cb8b4f17ee0e/displayicon.png',
        tier: { name: 'Premium Edition', color: '#d1548d' },
        originalCost: 1775,
        discountedCost: 1065,
        discountPercent: 40,
        isSeen: true,
        streamedVideo: 'https://media.valorant-api.com/weaponskinlevels/3e954546-4a41-2e21-0a6a-cb8b4f17ee0e/streamedvideo.mp4'
      },
      {
        uuid: 'ion-sheriff',
        displayName: 'Ion Sheriff',
        displayIcon: 'https://media.valorant-api.com/weaponskinlevels/f910ba1b-4f81-79b9-d2b1-59929d20c576/displayicon.png',
        tier: { name: 'Premium Edition', color: '#d1548d' },
        originalCost: 1775,
        discountedCost: 1242,
        discountPercent: 30,
        isSeen: true,
        streamedVideo: 'https://media.valorant-api.com/weaponskinlevels/f910ba1b-4f81-79b9-d2b1-59929d20c576/streamedvideo.mp4'
      },
      {
        uuid: 'magepunk-ghost',
        displayName: 'Magepunk Ghost',
        displayIcon: 'https://media.valorant-api.com/weaponskinlevels/b4e6d4aa-4cf6-3dc9-f834-8c88725890b0/displayicon.png',
        tier: { name: 'Premium Edition', color: '#d1548d' },
        originalCost: 1775,
        discountedCost: 887,
        discountPercent: 50,
        isSeen: true,
        streamedVideo: 'https://media.valorant-api.com/weaponskinlevels/b4e6d4aa-4cf6-3dc9-f834-8c88725890b0/streamedvideo.mp4'
      },
      {
        uuid: 'recon-phantom',
        displayName: 'Recon Phantom',
        displayIcon: 'https://media.valorant-api.com/weaponskinlevels/e1f37e12-4eb5-5e3a-5942-83b63198083a/displayicon.png',
        tier: { name: 'Premium Edition', color: '#d1548d' },
        originalCost: 1775,
        discountedCost: 1331,
        discountPercent: 25,
        isSeen: true,
        streamedVideo: 'https://media.valorant-api.com/weaponskinlevels/e1f37e12-4eb5-5e3a-5942-83b63198083a/streamedvideo.mp4'
      },
      {
        uuid: 'infantry-operator',
        displayName: 'Infantry Operator',
        displayIcon: 'https://media.valorant-api.com/weaponskinlevels/0c9c7f66-419b-6101-7243-7f9a1286cbf5/displayicon.png',
        tier: { name: 'Select Edition', color: '#5a9fe2' },
        originalCost: 875,
        discountedCost: 525,
        discountPercent: 40,
        isSeen: true
      },
      {
        uuid: 'sovereign-marshal',
        displayName: 'Sovereign Marshal',
        displayIcon: 'https://media.valorant-api.com/weaponskinlevels/0a6fe0ba-4796-03f8-6e3e-cca2c39d73d6/displayicon.png',
        tier: { name: 'Premium Edition', color: '#d1548d' },
        originalCost: 1775,
        discountedCost: 1153,
        discountPercent: 35,
        isSeen: true
      }
    ];

    // Demo Accessory Store items
    const demoAccessories = Array.from(skinCache.accessories.values()).slice(0, 4).map((acc, idx) => ({
      ...acc,
      cost: (idx + 1) * 1500
    }));

    return {
      success: true,
      mode: 'demo',
      player: {
        gameName: 'RadiantAgent',
        tagLine: 'DEMO',
        puuid: 'demo-puuid',
        region: 'ap'
      },
      wallet: {
        vp: 4250,
        kc: 7800,
        rp: 140
      },
      rank: {
        tier: 19,
        tierName: 'DIAMOND 2',
        rankedRating: 74,
        largeIcon: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/19/largeicon.png',
        color: '#ab70e6'
      },
      dailyOffers: {
        items: demoItems,
        remainingSeconds: 43200,
        endsAt: new Date(Date.now() + 43200 * 1000).toISOString()
      },
      featuredBundles: {
        bundles: [
          {
            id: 'demo-bundle',
            displayName: 'Arcane 2.0 Collection',
            displayIcon: 'https://media.valorant-api.com/bundles/afdba6be-446d-81c3-bf8d-20a6a1cc5af0/displayicon.png',
            totalBaseCost: 6500,
            totalDiscountedCost: 5160,
            discountPercent: 20,
            remainingSeconds: 86400 * 5,
            items: demoItems.slice(0, 2)
          }
        ],
        remainingSeconds: 86400 * 5,
        endsAt: new Date(Date.now() + 86400 * 5 * 1000).toISOString()
      },
      nightMarket: {
        isActive: true,
        items: demoNightMarketItems,
        remainingSeconds: 86400 * 12,
        endsAt: new Date(Date.now() + 86400 * 12 * 1000).toISOString()
      },
      accessoryStore: {
        items: demoAccessories.length > 0 ? demoAccessories : [
          {
            uuid: 'demo-card-1',
            type: 'card',
            typeName: 'Player Card',
            displayName: 'Viper Protocol Card',
            displayIcon: 'https://media.valorant-api.com/playercards/9edcb43d-4102-0dfc-3784-19a927a76968/largeart.png',
            cost: 4000
          }
        ],
        remainingSeconds: 64800,
        endsAt: new Date(Date.now() + 64800 * 1000).toISOString()
      },
      fetchedAt: new Date().toISOString()
    };
  }
}

const storeService = new StoreService();
module.exports = storeService;
