#include "handling.h"

json __stat_to_json(process_stat &ps) {
  json j;

  j["id"] = ps.id;
  j["waitingTime"] = ps.waitingTime;
  j["turnaroundTime"] = ps.turnaroundTime;
  j["responseTime"] = ps.responseTime;
  j["finishTime"] = ps.finishTime;

  return j;
}
