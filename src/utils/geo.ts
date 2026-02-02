export function metersToConfidence(distanceM: number): 'high' | 'medium' | 'low' {
  if (distanceM <= 100) return 'high';
  if (distanceM <= 300) return 'medium';
  return 'low';
}


