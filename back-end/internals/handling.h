#ifndef __HANDLING_H
#define __HANDLING_H

#include <nlohmann/json.hpp>

using json = nlohmann::json;

typedef enum { IDLE = -1, OVERLOAD = -2 } CPUTimeline;

typedef struct {
  int id;
  int waitingTime;
  int turnaroundTime;
  int responseTime;
  int finishTime;
} process_stat;

#endif
