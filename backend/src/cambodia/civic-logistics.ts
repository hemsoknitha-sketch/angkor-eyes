export interface GeographicCoordinate {
  name: string;
  lat: number;
  lng: number;
  type: 'khan' | 'province' | 'landmark';
}

export const CAMBODIA_GEO_BENCHMARKS: Record<string, GeographicCoordinate> = {
  // Urban Khans in Phnom Penh (higher priority for granular detection)
  'daun_penh': { name: 'ខណ្ឌដូនពេញ (Daun Penh)', lat: 11.5725, lng: 104.9242, type: 'khan' },
  'chamkarmon': { name: 'ខណ្ឌចំការមន (Chamkarmon)', lat: 11.5436, lng: 104.9272, type: 'khan' },
  'toul_kork': { name: 'ខណ្ឌទួលគោក (Toul Kork)', lat: 11.5784, lng: 104.8968, type: 'khan' },
  'bkk1': { name: 'បឹងកេងកង ១ (BKK1)', lat: 11.5505, lng: 104.9218, type: 'khan' },
  'sen_sok': { name: 'ខណ្ឌសែនសុខ (Sen Sok)', lat: 11.5833, lng: 104.8667, type: 'khan' },
  'meanchey': { name: 'ខណ្ឌមានជ័យ (Meanchey)', lat: 11.5167, lng: 104.9167, type: 'khan' },
  'chbar_ampov': { name: 'ខណ្ឌច្បារអំពៅ (Chbar Ampov)', lat: 11.5333, lng: 104.9500, type: 'khan' },

  // Provinces & Capital
  'phnom_penh': { name: 'រាជធានីភ្នំពេញ (Phnom Penh)', lat: 11.5564, lng: 104.9282, type: 'province' },
  'siem_reap': { name: 'ខេត្តសៀមរាប (Siem Reap)', lat: 13.3671, lng: 103.8448, type: 'province' },
  'battambang': { name: 'ខេត្តបាត់ដំបង (Battambang)', lat: 13.0957, lng: 103.2022, type: 'province' },
  'sihanoukville': { name: 'ខេត្តព្រះសីហនុ (Preah Sihanouk)', lat: 10.6275, lng: 103.5221, type: 'province' }
};

export class CivicGeocodingAndHotzoneRadar {
  /**
   * Computes geographical Haversine distance in kilometers between two GPS coordinates.
   */
  public static haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Detects the nearest Cambodian administrative Khan/Province from text or coordinates.
   */
  public static resolveLocation(locationQuery: string): GeographicCoordinate {
    const qLower = locationQuery.toLowerCase();

    // Check specific khans and provinces with root-word matching
    for (const [key, geo] of Object.entries(CAMBODIA_GEO_BENCHMARKS)) {
      const khmerFull = geo.name.split('(')[0].trim().toLowerCase();
      const khmerRoot = khmerFull.replace(/^(ខណ្ឌ|ខេត្ត|រាជធានី|ក្រុង)\s*/, '').trim();
      const engMatch = geo.name.match(/\((.*?)\)/);
      const engFull = engMatch ? engMatch[1].toLowerCase() : '';
      const spaceKey = key.replace(/_/g, ' ');

      if (
        qLower.includes(key) ||
        qLower.includes(spaceKey) ||
        (khmerRoot && qLower.includes(khmerRoot)) ||
        (khmerFull && qLower.includes(khmerFull)) ||
        (engFull && qLower.includes(engFull))
      ) {
        return geo;
      }
    }
    // Default to Phnom Penh Capital
    return CAMBODIA_GEO_BENCHMARKS['phnom_penh'];
  }

  /**
   * Identifies civic complaint clusters / hotzones across Cambodia.
   */
  public static clusterHotzones(reports: Array<{ locationText: string; topic: string }>): {
    hotzoneFound: boolean;
    primaryZoneName: string;
    reportCount: number;
    khmerAlertMessage: string;
  } {
    if (!reports || reports.length === 0) {
      return {
        hotzoneFound: false,
        primaryZoneName: 'គ្មាន',
        reportCount: 0,
        khmerAlertMessage: 'មិនទាន់មានចង្កោមបញ្ហាប្រមូលផ្តុំនៅតំបន់ណាមួយនៅឡើយ ៕'
      };
    }

    const counts: Record<string, number> = {};
    for (const r of reports) {
      const geo = this.resolveLocation(r.locationText);
      counts[geo.name] = (counts[geo.name] || 0) + 1;
    }

    let topZone = '';
    let maxCount = 0;
    for (const [zone, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        topZone = zone;
      }
    }

    const isHotspot = maxCount >= 2;
    const msg = isHotspot
      ? `🚨 **ការជូនដំណឹងអំពីចង្កោមបញ្ហាក្តៅ (Civic Hotzone Alert)** ៖\nរកឃើញការប្រមូលផ្តុំកង្វល់របស់ប្រជាពលរដ្ឋចំនួន **${maxCount} ករណី** នៅតំបន់ **${topZone}**។ អាជ្ញាធរដែនដី និងស្ថាប័នពាក់ព័ន្ធគប្បីចុះពិនិត្យ និងសម្របសម្រួលជាបន្ទាន់ ៕`
      : `ស្ថានភាពទូទៅនៅតាមរាជធានី-ខេត្ត មានស្ថិរភាពល្អ គ្មានចង្កោមបញ្ហាធ្ងន់ធ្ងរឡើយ ៕`;

    return {
      hotzoneFound: isHotspot,
      primaryZoneName: topZone || 'ទូទៅ',
      reportCount: maxCount,
      khmerAlertMessage: msg
    };
  }
}

export class ZeroClickPredictiveGovernor {
  private static cooldowns: Map<string, number> = new Map();
  private static defaultCooldownMs = 60 * 1000; // 60s cooldown for testing, 24h in production

  /**
   * Anti-Spam & Confidence Guard: Only permits alert dispatch if confidence > 90% and not in cooldown.
   */
  public static evaluateAlert(params: {
    alertKey: string;
    confidencePct: number;
    title: string;
    cooldownMs?: number;
  }): { shouldDispatch: boolean; reason: string } {
    const { alertKey, confidencePct, title, cooldownMs } = params;
    const now = Date.now();
    const period = cooldownMs || this.defaultCooldownMs;

    // 1. High Confidence Rule (Must be >= 90%)
    if (confidencePct < 90.0) {
      return {
        shouldDispatch: false,
        reason: `កម្រិតទំនុកចិត្តមិនទាន់ដល់ (${confidencePct.toFixed(1)}% < 90.0%)។ មិនបញ្ជូនការរំខានឡើយ។`
      };
    }

    // 2. Anti-Spam Cooldown Rule
    const lastAlertTime = this.cooldowns.get(alertKey);
    if (lastAlertTime && now - lastAlertTime < period) {
      const remainingSec = Math.ceil((period - (now - lastAlertTime)) / 1000);
      return {
        shouldDispatch: false,
        reason: `ស្ថិតក្នុងរយៈពេលរង់ចាំប្រឆាំងការ Spam (Cooldown)។ សូមរង់ចាំ ${remainingSec} វិនាទីទៀត។`
      };
    }

    // 3. Approved! Record timestamp
    this.cooldowns.set(alertKey, now);
    return {
      shouldDispatch: true,
      reason: `បានអនុម័ត ៖ កម្រិតទំនុកចិត្តខ្ពស់ ${confidencePct.toFixed(1)}% និងផុតរយៈពេល Cooldown ៕`
    };
  }
}
