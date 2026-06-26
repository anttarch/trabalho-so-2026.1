#include <vector>

#include "core.h"
#include "handling.cc"

void Simulator::run(const payload &p) {
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
    // case algorithms::SAMPLE:
    //   SampleScheduler::run(p, &result.timeline);
    //   break;
  }

  if (this->result.timeline.size() > 0) {
    this->calculate_stats(p.process_list);
  }
}

void Simulator::calculate_stats(const std::vector<process> &vp) {
  std::vector<int> t = result.timeline;

  for (process p : vp) {
    int finish = 0;
    for (int i = t.size(); i > 0; i--) {
      if (t[i] == p.id) {
        finish = i + 1;
        break;
      }
    }

    int firstExecution = 0;
    for (int i = 0; i < t.size(); i++) {
      if (t[i] == p.id) {
        firstExecution = i;
        break;
      }
    }

    int w = finish - p.burstTime;
    int ta = finish - p.absoluteArrivalTime;
    int r = firstExecution - p.absoluteArrivalTime;

    process_stat ps = {.id = p.id,
                       .waitingTime = w,
                       .turnaroundTime = ta,
                       .responseTime = r,
                       .finishTime = finish};
    result.process_stats.emplace_back(ps);
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
