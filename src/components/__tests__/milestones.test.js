import { computeYearMilestones } from '../../utils/exhibitions';

describe('computeYearMilestones', () => {
  it('marks every 5th item per year with cumulative count', () => {
    const mk = (id, date) => ({ id: String(id), visitDate: date });
    const list = [
      mk(1, '2025-01-01'),
      mk(2, '2025-01-02'),
      mk(3, '2025-01-03'),
      mk(4, '2025-01-04'),
      mk(5, '2025-01-05'), // 5
      mk(6, '2025-01-06'),
      mk(7, '2025-01-07'),
      mk(8, '2025-01-08'),
      mk(9, '2025-01-09'),
      mk(10, '2025-01-10'), // 10
      mk(11, '2024-03-01'),
      mk(12, '2024-03-02'),
      mk(13, '2024-03-03'),
      mk(14, '2024-03-04'),
      mk(15, '2024-03-05'), // 5 in 2024
    ];
    const res = computeYearMilestones(list);
    expect(res['5']).toBe(5);
    expect(res['10']).toBe(10);
    expect(res['15']).toBe(5);
  });

  it('returns empty when less than 5 per year', () => {
    const list = [
      { id: 'a', visitDate: '2023-01-01' },
      { id: 'b', visitDate: '2023-01-02' },
      { id: 'c', visitDate: '2023-01-03' },
    ];
    const res = computeYearMilestones(list);
    expect(Object.keys(res).length).toBe(0);
  });

  it('handles mixed years and maintains independent counts', () => {
    const list = [
      { id: 'y1-1', visitDate: '2022-01-01' },
      { id: 'y2-1', visitDate: '2021-01-01' },
      { id: 'y1-2', visitDate: '2022-01-02' },
      { id: 'y2-2', visitDate: '2021-01-02' },
      { id: 'y1-3', visitDate: '2022-01-03' },
      { id: 'y1-4', visitDate: '2022-01-04' },
      { id: 'y1-5', visitDate: '2022-01-05' }, // 5 for 2022
    ];
    const res = computeYearMilestones(list);
    expect(res['y1-5']).toBe(5);
    expect(res['y2-2']).toBeUndefined();
  });
});


