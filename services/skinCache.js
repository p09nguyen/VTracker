/**
 * Skin and Game Asset Cache Service
 * Fetches and indexes metadata from https://valorant-api.com
 */

class SkinCache {
  constructor() {
    this.clientVersion = 'release-13.09-shipping-11-5777412';
    this.skinLevels = new Map();
    this.skins = new Map();
    this.tiers = new Map();
    this.bundles = new Map();
    this.accessories = new Map();
    this.competitiveTiers = new Map();
    this.seasons = [];
    this.searchList = [];
    this.isReady = false;
    this.lastUpdated = null;
  }

  async init() {
    try {
      console.log('[SkinCache] Initializing Valorant asset cache...');
      await this.fetchVersion();
      await Promise.all([
        this.fetchTiers(),
        this.fetchCompetitiveTiers(),
        this.fetchSeasons(),
        this.fetchSkins(),
        this.fetchBundles(),
        this.fetchAccessories()
      ]);
      this.buildSearchIndex();
      this.isReady = true;
      this.lastUpdated = new Date();
      console.log(`[SkinCache] Cache ready! Indexed ${this.skins.size} skins, ${this.skinLevels.size} levels, ${this.accessories.size} accessories, ${this.competitiveTiers.size} rank tiers, ${this.seasons.length} acts.`);
    } catch (err) {
      console.error('[SkinCache] Failed to initialize cache:', err.message);
    }
  }

  async fetchVersion() {
    try {
      const res = await fetch('https://valorant-api.com/v1/version');
      const json = await res.json();
      if (json.status === 200 && json.data?.riotClientVersion) {
        this.clientVersion = json.data.riotClientVersion;
        console.log('[SkinCache] Client version:', this.clientVersion);
      }
    } catch (e) {
      console.warn('[SkinCache] Using fallback version:', this.clientVersion);
    }
  }

  async fetchTiers() {
    try {
      const res = await fetch('https://valorant-api.com/v1/contenttiers');
      const json = await res.json();
      if (json.data) {
        for (const tier of json.data) {
          const hex = (tier.highlightColor || 'ffffff33').slice(0, 6);
          this.tiers.set(tier.uuid, {
            uuid: tier.uuid,
            name: tier.displayName,
            devName: tier.devName,
            color: '#' + hex,
            icon: tier.displayIcon
          });
        }
      }
    } catch (e) {
      console.error('[SkinCache] Error loading tiers:', e.message);
    }
  }

  async fetchCompetitiveTiers() {
    try {
      const res = await fetch('https://valorant-api.com/v1/competitivetiers');
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        const latest = json.data[json.data.length - 1];
        if (latest && Array.isArray(latest.tiers)) {
          for (const t of latest.tiers) {
            const hex = t.color ? '#' + t.color.slice(0, 6) : '#94a3b8';
            this.competitiveTiers.set(t.tier, {
              tier: t.tier,
              tierName: t.tierName,
              divisionName: t.divisionName,
              color: hex,
              largeIcon: t.largeIcon || 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/largeicon.png',
              smallIcon: t.smallIcon || 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png'
            });
          }
          console.log(`[SkinCache] Loaded ${this.competitiveTiers.size} competitive rank tiers.`);
        }
      }
    } catch (e) {
      console.error('[SkinCache] Error loading competitive tiers:', e.message);
    }
  }

  resolveCompetitiveTier(tierNumber) {
    const num = Number(tierNumber) || 0;
    if (num <= 2) {
      return {
        tier: 0,
        tierName: 'UNRANKED',
        divisionName: 'UNRANKED',
        color: '#94a3b8',
        largeIcon: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/largeicon.png',
        smallIcon: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png'
      };
    }
    if (this.competitiveTiers.has(num)) {
      return this.competitiveTiers.get(num);
    }
    return {
      tier: num,
      tierName: `TIER ${num}`,
      divisionName: 'RANKED',
      color: '#94a3b8',
      largeIcon: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/largeicon.png',
      smallIcon: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/smallicon.png'
    };
  }

  async fetchSeasons() {
    try {
      const res = await fetch('https://valorant-api.com/v1/seasons');
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        this.seasons = json.data
          .filter(s => s.type === 'EAresSeasonType::Act')
          .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        console.log(`[SkinCache] Loaded ${this.seasons.length} seasons/acts. Current/Latest act: ${this.seasons[0]?.displayName} (${this.seasons[0]?.uuid})`);
      }
    } catch (e) {
      console.error('[SkinCache] Error loading seasons:', e.message);
    }
  }

  getCurrentAct() {
    const now = new Date();
    return this.seasons.find(s => new Date(s.startTime) <= now && now <= new Date(s.endTime)) || this.seasons[0] || null;
  }

  async fetchSkins() {
    try {
      const res = await fetch('https://valorant-api.com/v1/weapons/skins');
      const json = await res.json();
      if (json.data) {
        for (const skin of json.data) {
          // Skip standard/default skins that don't have shop presence
          const isStandard = skin.displayName.toLowerCase().startsWith('standard') ||
                             skin.displayName.toLowerCase().startsWith('meleestandard');

          const tier = skin.contentTierUuid ? this.tiers.get(skin.contentTierUuid) : null;

          const skinObj = {
            uuid: skin.uuid,
            displayName: skin.displayName,
            themeUuid: skin.themeUuid,
            contentTierUuid: skin.contentTierUuid,
            tier: tier || { name: 'Standard', color: '#94a3b8', icon: null },
            displayIcon: skin.displayIcon || (skin.levels && skin.levels[0]?.displayIcon),
            wallpaper: skin.wallpaper,
            chromas: (skin.chromas || []).map(c => ({
              uuid: c.uuid,
              displayName: c.displayName,
              displayIcon: c.displayIcon || skin.displayIcon,
              fullRender: c.fullRender,
              swatch: c.swatch,
              streamedVideo: c.streamedVideo
            })),
            levels: (skin.levels || []).map(l => ({
              uuid: l.uuid,
              displayName: l.displayName,
              levelItem: l.levelItem,
              displayIcon: l.displayIcon || skin.displayIcon,
              streamedVideo: l.streamedVideo
            })),
            isStandard
          };

          this.skins.set(skin.uuid, skinObj);

          // Index each level and item offer ID back to parent skin
          if (skin.levels) {
            for (const lvl of skin.levels) {
              this.skinLevels.set(lvl.uuid, {
                ...lvl,
                parentSkin: skinObj
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('[SkinCache] Error loading skins:', e.message);
    }
  }

  async fetchBundles() {
    try {
      const res = await fetch('https://valorant-api.com/v1/bundles');
      const json = await res.json();
      if (json.data) {
        for (const b of json.data) {
          this.bundles.set(b.uuid, {
            uuid: b.uuid,
            displayName: b.displayName,
            displayNameSubText: b.displayNameSubText,
            description: b.description,
            extraDescription: b.extraDescription,
            displayIcon: b.displayIcon,
            displayIcon2: b.displayIcon2,
            verticalPromoImage: b.verticalPromoImage
          });
        }
      }
    } catch (e) {
      console.error('[SkinCache] Error loading bundles:', e.message);
    }
  }

  async fetchAccessories() {
    try {
      const [cards, sprays, buddies, titles] = await Promise.all([
        fetch('https://valorant-api.com/v1/playercards').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/sprays').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/buddies').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('https://valorant-api.com/v1/playertitles').then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      if (cards.data) {
        for (const c of cards.data) {
          this.accessories.set(c.uuid, {
            uuid: c.uuid,
            type: 'card',
            typeName: 'Player Card',
            displayName: c.displayName,
            displayIcon: c.largeArt || c.displayIcon || c.wideArt,
            wideArt: c.wideArt,
            smallArt: c.smallArt
          });
        }
      }

      if (sprays.data) {
        for (const s of sprays.data) {
          this.accessories.set(s.uuid, {
            uuid: s.uuid,
            type: 'spray',
            typeName: 'Spray',
            displayName: s.displayName,
            displayIcon: s.fullTransparentIcon || s.displayIcon || s.animationPng
          });
        }
      }

      if (buddies.data) {
        for (const b of buddies.data) {
          this.accessories.set(b.uuid, {
            uuid: b.uuid,
            type: 'buddy',
            typeName: 'Gun Buddy',
            displayName: b.displayName,
            displayIcon: b.displayIcon
          });
          // Also index levels
          if (b.levels) {
            for (const lvl of b.levels) {
              this.accessories.set(lvl.uuid, {
                uuid: lvl.uuid,
                type: 'buddy',
                typeName: 'Gun Buddy',
                displayName: b.displayName,
                displayIcon: lvl.displayIcon || b.displayIcon
              });
            }
          }
        }
      }

      if (titles.data) {
        for (const t of titles.data) {
          this.accessories.set(t.uuid, {
            uuid: t.uuid,
            type: 'title',
            typeName: 'Player Title',
            displayName: t.displayName,
            titleText: t.titleText,
            displayIcon: null
          });
        }
      }
    } catch (e) {
      console.error('[SkinCache] Error loading accessories:', e.message);
    }
  }

  buildSearchIndex() {
    this.searchList = [];
    for (const [uuid, skin] of this.skins.entries()) {
      if (skin.isStandard) continue;
      this.searchList.push({
        uuid: skin.uuid,
        displayName: skin.displayName,
        displayIcon: skin.displayIcon,
        tier: skin.tier,
        // Find best video preview if any
        streamedVideo: skin.levels.find(l => l.streamedVideo)?.streamedVideo || 
                       skin.chromas.find(c => c.streamedVideo)?.streamedVideo || null
      });
    }
    // Sort alphabetically
    this.searchList.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Resolve an item UUID (level UUID or skin UUID) to enriched skin object
   */
  resolveSkinItem(itemUuid, cost = null) {
    let levelData = this.skinLevels.get(itemUuid);
    let skinData = this.skins.get(itemUuid);

    if (levelData && levelData.parentSkin) {
      skinData = levelData.parentSkin;
    }

    if (!skinData && !levelData) {
      return {
        uuid: itemUuid,
        displayName: 'Unknown Skin Offer',
        displayIcon: null,
        tier: { name: 'Unknown', color: '#64748b', icon: null },
        cost: cost || 0,
        chromas: [],
        levels: [],
        streamedVideo: null
      };
    }

    const tier = skinData?.tier || { name: 'Standard', color: '#94a3b8', icon: null };
    const displayIcon = levelData?.displayIcon || skinData?.displayIcon || null;
    
    // Choose primary preview video: finisher level, or highest level video
    let streamedVideo = null;
    if (skinData?.levels) {
      const withVideo = skinData.levels.filter(l => l.streamedVideo);
      if (withVideo.length > 0) {
        streamedVideo = withVideo[withVideo.length - 1].streamedVideo;
      }
    }

    return {
      uuid: skinData?.uuid || itemUuid,
      offerUuid: itemUuid,
      displayName: skinData?.displayName || levelData?.displayName,
      displayIcon,
      wallpaper: skinData?.wallpaper,
      tier,
      cost: cost || 0,
      chromas: skinData?.chromas || [],
      levels: skinData?.levels || [],
      streamedVideo
    };
  }

  /**
   * Resolve accessory item UUID (card, spray, buddy, title)
   */
  resolveAccessoryItem(itemUuid, cost = null) {
    const acc = this.accessories.get(itemUuid);
    if (!acc) {
      return {
        uuid: itemUuid,
        type: 'accessory',
        typeName: 'Accessory',
        displayName: 'Unknown Accessory',
        displayIcon: null,
        cost: cost || 0
      };
    }
    return {
      ...acc,
      cost: cost || 0
    };
  }

  /**
   * Resolve bundle by UUID
   */
  resolveBundle(bundleUuid) {
    return this.bundles.get(bundleUuid) || {
      uuid: bundleUuid,
      displayName: 'Featured Collection',
      displayIcon: null,
      description: ''
    };
  }
}

const skinCache = new SkinCache();
module.exports = skinCache;
