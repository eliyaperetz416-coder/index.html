// Traffic vehicle types. weight = spawn probability weight.
export const TRAFFIC_TYPES = [
  { id: 'sedan', weight: 5, model: { type: 'car', body: 'sedan', length: 4.3, width: 1.8, height: 1.35 } },
  { id: 'hatch', weight: 4, model: { type: 'car', body: 'sedan', length: 3.9, width: 1.75, height: 1.4 } },
  { id: 'suv',   weight: 3, model: { type: 'car', body: 'suv',   length: 4.6, width: 1.95, height: 1.7 } },
  { id: 'van',   weight: 2, model: { type: 'car', body: 'van',   length: 5.2, width: 2.0, height: 2.1 } },
  { id: 'truck', weight: 1.4, model: { type: 'car', body: 'truck', length: 9.5, width: 2.4, height: 3.0 } },
];
export const TRAFFIC_COLORS = [0x9aa3b2, 0xb0b6c4, 0x23262e, 0x6b1b2a, 0x1c3a5e, 0x2d5a45, 0xd8d8d0, 0x7a6a3a, 0x4a3a66];
