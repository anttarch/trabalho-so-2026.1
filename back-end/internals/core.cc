#include <algorithm>
#include <vector>

#include "../schedulers/cfs.h"
#include "../schedulers/edf.h"
#include "../schedulers/sjf.h"
#include "../schedulers/priority.h"
#include "../schedulers/custom.h"

#include "core.h"
#include "handling.h"

void Simulator::run(const payload &p) {
  // redireciona para os diferentes algoritmos
  switch (p.algorithm) {
  case algorithms::FIFO:
    // TODO
    break;
  case algorithms::SJF:
      SJFScheduler::run(p, &result.timeline);
    break;
  case algorithms::RR:
    // TODO
    break;
  case algorithms::PRIO:
    PriorityScheduler::run(p, &result.timeline);
    break;
  case algorithms::EDF:
    EDFScheduler::run(p, &result.timeline);
    break;
  case algorithms::CFS:
    CFSScheduler::run(p, &result.timeline);
    break;
  case algorithms::CUSTOM:
    CustomScheduler::run(p, &result.timeline);
    break;
    // case algorithms::SAMPLE:
    //   SampleScheduler::run(p, &result.timeline);
    //   break;
  }

  if (this->result.timeline.size() > 0) {
    this->calculate_stats(p.process_list, &p);
  }
}

void Simulator::calculate_stats(const std::vector<process> &vp, const payload *p) {
  std::vector<int> t = result.timeline;

  for (process p : vp) {
    int finish = 0;
    for (int i = t.size() - 1; i > 0; i--) {
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

    int w = finish - p.burst_time;
    int ta = finish - p.absolute_arrival_time;
    int r = firstExecution - p.absolute_arrival_time;

    process_stat ps;
    ps.id = p.id;
    ps.waiting_time = w;
    ps.turnaround_time = ta;
    ps.response_time = r;
    ps.finish_time = finish;
    result.process_stats.emplace_back(ps);
  }

  int idle = std::count(t.cbegin(), t.cend(), CPUTimeline::IDLE);

  result.idle_percentage = t.size() > 0 ? (((double)idle / t.size()) * 100.0) : 0.0;
  result.throughput = t.size() > 0 ? ((double)vp.size() / t.size()) : 0.0;

  int context_switches = std::count(t.cbegin(), t.cend(), CPUTimeline::OVERLOAD);
  result.context_switches = p->overload > 0 ? context_switches / p->overload : 0;

  int preemptions = 0;
  std::vector<int> remaining_burst(vp.size());
  for (size_t i = 0; i < vp.size(); i++) {
    remaining_burst[i] = vp[i].burst_time;
  }

  int prev_proc = -1;
  for (int val : t) {
    if (val > 0) {
      int current_idx = -1;
      for (size_t i = 0; i < vp.size(); i++) {
        if (vp[i].id == val) {
          current_idx = i;
          break;
        }
      }

      if (prev_proc != -1 && val != prev_proc) {
        int prev_idx = -1;
        for (size_t i = 0; i < vp.size(); i++) {
          if (vp[i].id == prev_proc) {
            prev_idx = i;
            break;
          }
        }
        if (prev_idx != -1 && remaining_burst[prev_idx] > 0) {
          preemptions++;
        }
      }

      if (current_idx != -1 && remaining_burst[current_idx] > 0) {
        remaining_burst[current_idx]--;
      }
      prev_proc = val;
    }
  }
  result.preemptions = preemptions;
}

ordered_json __stat_to_json(process_stat &ps) {
  ordered_json j;

  j["id"] = ps.id;
  j["waitingTime"] = ps.waiting_time;
  j["turnaroundTime"] = ps.turnaround_time;
  j["responseTime"] = ps.response_time;
  j["finishTime"] = ps.finish_time;

  return j;
}

ordered_json Simulator::process_result() {
  ordered_json j;

  j["timeline"] = this->result.timeline;

  std::vector<ordered_json> v;
  for (auto ps : this->result.process_stats) {
    ordered_json a = __stat_to_json(ps);
    v.emplace_back(a);
  }

  j["processStats"] = v;
  j["throughput"] = this->result.throughput;
  j["idlePercentage"] = this->result.idle_percentage;
  j["preemptions"] = this->result.preemptions;
  j["contextSwitches"] = this->result.context_switches;

  return j;
}
