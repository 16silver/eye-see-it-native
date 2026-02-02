import { haversineDistanceMeters } from '../../utils/capturePolicy';
import { metersToConfidence } from '../../utils/geo';

function assert(name: string, cond: boolean) {
  if (!cond) throw new Error('Test failed: ' + name);
}

// Basic sanity checks so we can manually run this file in any TS runner
(function run() {
  const d0 = haversineDistanceMeters({ lat: 37.5665, lng: 126.9780 }, { lat: 37.5665, lng: 126.9780 });
  assert('zero distance ~ 0', d0 < 1);

  const d1 = haversineDistanceMeters({ lat: 37.5665, lng: 126.9780 }, { lat: 37.5655, lng: 126.9780 });
  assert('1km-ish south', d1 > 100 && d1 < 200);

  assert('confidence high', metersToConfidence(50) === 'high');
  assert('confidence medium', metersToConfidence(150) === 'medium');
  assert('confidence low', metersToConfidence(400) === 'low');
})();


