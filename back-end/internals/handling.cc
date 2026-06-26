#include "handling.h"

json __stat_to_json(process_stat &ps) {
  json j;

  j["id"] = ps.id;
  j["waitingTime"] = ps.waiting_time;
  j["turnaroundTime"] = ps.turnaround_time;
  j["responseTime"] = ps.response_time;
  j["finishTime"] = ps.finish_time;

  return j;
}
