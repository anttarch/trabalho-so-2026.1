#include <vector>

#include "core.h"
#include "handling.cc"

void Simulator::run(payload &p) {
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

json Simulator::process_result() {
  json j;

  j["timeline"] = this->result.timeline;

  std::vector<basic_json<>> v;
  for (auto ps : this->result.process_stats) {
    json a = __stat_to_json(ps);
    v.emplace_back(a);
  }

  j["processStats"] = v;

  return j;
}
