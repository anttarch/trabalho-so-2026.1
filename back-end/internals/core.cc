#include "core.h"

class Simulator {
public:
  void run(payload &p) {
    // redireciona para os diferentes algoritmos
    switch (p.algorithm) {
    case algorithms::FIFO:
      // TODO
    case algorithms::SJF:
      // TODO
    case algorithms::RR:
      // TODO
    case algorithms::PRIO:
      // TODO
    case algorithms::EDF:
      // TODO
    case algorithms::CFS:
      // TODO
    case algorithms::CUSTOM:
      // TODO
      break;
    }
  }
}
