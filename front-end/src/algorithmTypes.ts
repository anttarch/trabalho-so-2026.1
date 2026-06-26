// mas q curva do cacete
// isso aqui n é vida n
//
// manter esse arquivo sincronizado com
// "back-end/internals/algorithms.h"
//

export const algorithmType = {
  FIFO: 0,
  SJF: 1,
  RR: 2,
  PRIO: 3,
  EDF: 4,
  CFS: 5,
  CUSTOM: 6,
} as const;

export type TAlgorithmType = (typeof algorithmType)[keyof typeof algorithmType];

export function algorithmTypeToValue<K extends typeof algorithmType>(
  value: K[keyof K],
): K[keyof K] {
  switch (value) {
    case algorithmType.FIFO:
      return algorithmType.FIFO as K[keyof K];
    case algorithmType.SJF:
      return algorithmType.SJF as K[keyof K];
    case algorithmType.RR:
      return algorithmType.RR as K[keyof K];
    case algorithmType.PRIO:
      return algorithmType.PRIO as K[keyof K];
    case algorithmType.EDF:
      return algorithmType.EDF as K[keyof K];
    case algorithmType.CFS:
      return algorithmType.CFS as K[keyof K];
    case algorithmType.CUSTOM:
      return algorithmType.CUSTOM as K[keyof K];
  }
}
