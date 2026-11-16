import type { District, Mandal, State, Village } from './types';

export const STATES: State[] = [
  { id: 'tg', name: 'Telangana', nameTe: 'తెలంగాణ' },
  { id: 'ap', name: 'Andhra Pradesh', nameTe: 'ఆంధ్రప్రదేశ్' },
];

export const DISTRICTS: District[] = [
  { id: 'hyd', stateId: 'tg', name: 'Hyderabad', nameTe: 'హైదరాబాద్', lat: 17.385, lng: 78.4867 },
  { id: 'wgl', stateId: 'tg', name: 'Warangal', nameTe: 'వరంగల్', lat: 17.9689, lng: 79.5941 },
  { id: 'vsp', stateId: 'ap', name: 'Visakhapatnam', nameTe: 'విశాఖపట్నం', lat: 17.6868, lng: 83.2185 },
];

export const MANDALS: Mandal[] = [
  { id: 'hyd-amp', districtId: 'hyd', name: 'Ameerpet', nameTe: 'అమీర్‌పేట', lat: 17.4375, lng: 78.4483 },
  { id: 'hyd-sec', districtId: 'hyd', name: 'Secunderabad', nameTe: 'సికింద్రాబాద్', lat: 17.4399, lng: 78.4983 },
  { id: 'hyd-khr', districtId: 'hyd', name: 'Khairatabad', nameTe: 'ఖైరతాబాద్', lat: 17.4126, lng: 78.4605 },
  { id: 'hyd-cha', districtId: 'hyd', name: 'Charminar', nameTe: 'చార్మినార్', lat: 17.3616, lng: 78.4747 },
  { id: 'wgl-hnk', districtId: 'wgl', name: 'Hanamkonda', nameTe: 'హనుమకొండ', lat: 18.0072, lng: 79.5582 },
  { id: 'wgl-kzp', districtId: 'wgl', name: 'Kazipet', nameTe: 'కాజీపేట', lat: 17.9754, lng: 79.5047 },
  { id: 'wgl-wgl', districtId: 'wgl', name: 'Warangal Fort', nameTe: 'వరంగల్ కోట', lat: 17.9576, lng: 79.6146 },
  { id: 'wgl-nsp', districtId: 'wgl', name: 'Narsampet', nameTe: 'నర్సంపేట', lat: 17.9283, lng: 79.8946 },
  { id: 'vsp-gjw', districtId: 'vsp', name: 'Gajuwaka', nameTe: 'గాజువాక', lat: 17.6912, lng: 83.2071 },
  { id: 'vsp-bhm', districtId: 'vsp', name: 'Bheemunipatnam', nameTe: 'భీమునిపట్నం', lat: 17.8902, lng: 83.4532 },
  { id: 'vsp-pdr', districtId: 'vsp', name: 'Pendurthi', nameTe: 'పెందుర్తి', lat: 17.8114, lng: 83.2097 },
  { id: 'vsp-msp', districtId: 'vsp', name: 'MVP Colony', nameTe: 'ఎంవీపీ కాలనీ', lat: 17.7425, lng: 83.3364 },
];

export const VILLAGES: Village[] = [
  { id: 'v-srn', mandalId: 'hyd-amp', name: 'SR Nagar', nameTe: 'ఎస్‌ఆర్ నగర్' },
  { id: 'v-bkp', mandalId: 'hyd-amp', name: 'Begumpet', nameTe: 'బేగంపేట' },
  { id: 'v-mrd', mandalId: 'hyd-sec', name: 'Marredpally', nameTe: 'మారేడ్‌పల్లి' },
  { id: 'v-bjh', mandalId: 'hyd-khr', name: 'Banjara Hills', nameTe: 'బంజారాహిల్స్' },
  { id: 'v-pth', mandalId: 'hyd-cha', name: 'Pathergatti', nameTe: 'పత్తర్‌గట్టి' },
  { id: 'v-sbr', mandalId: 'wgl-hnk', name: 'Subedari', nameTe: 'సుబేదారి' },
  { id: 'v-mdk', mandalId: 'wgl-kzp', name: 'Madikonda', nameTe: 'మడికొండ' },
  { id: 'v-ork', mandalId: 'wgl-wgl', name: 'Orugallu', nameTe: 'ఓరుగల్లు' },
  { id: 'v-chn', mandalId: 'wgl-nsp', name: 'Chennaraopet', nameTe: 'చెన్నారావుపేట' },
  { id: 'v-pdk', mandalId: 'vsp-gjw', name: 'Pedagantyada', nameTe: 'పెదగంట్యాడ' },
  { id: 'v-tgr', mandalId: 'vsp-bhm', name: 'Tagarapuvalasa', nameTe: 'తగరపువలస' },
  { id: 'v-sim', mandalId: 'vsp-pdr', name: 'Simhachalam', nameTe: 'సింహాచలం' },
  { id: 'v-rkb', mandalId: 'vsp-msp', name: 'RK Beach', nameTe: 'ఆర్‌కే బీచ్' },
];

export const districtById = (id: string) => DISTRICTS.find((d) => d.id === id);
export const mandalById = (id: string) => MANDALS.find((m) => m.id === id);
export const villageById = (id: string) => VILLAGES.find((v) => v.id === id);
export const stateById = (id: string) => STATES.find((s) => s.id === id);

/** Find the nearest mandal to a GPS coordinate (used for auto-detect). */
export function nearestMandal(lat: number, lng: number): Mandal {
  let best = MANDALS[0];
  let bestD = Infinity;
  for (const m of MANDALS) {
    const d = haversineKm(lat, lng, m.lat, m.lng);
    if (d < bestD) { best = m; bestD = d; }
  }
  return best;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const placeName = (lang: string, p?: { name: string; nameTe: string }) =>
  !p ? '' : lang === 'te' ? p.nameTe : p.name;
