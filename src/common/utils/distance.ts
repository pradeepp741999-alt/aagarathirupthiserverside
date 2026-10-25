export interface Coordinates {
  lat: number;
  lng: number;
}

export function haversineKm(point1: Coordinates, point2: Coordinates): number {
  const toRad = (angle: number) => (angle * Math.PI) / 180;
  const R = 6371; // Earth's mean radius in km

  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
}
