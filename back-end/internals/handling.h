#ifndef __HANDLING_H
#define __HANDLING_H

#include <nlohmann/json.hpp>

using json = nlohmann::json;

typedef enum { IDLE = -1, OVERLOAD = -2 } CPUTimeline;

typedef struct {
  int id;
  int waiting_time;
  int turnaround_time;
  int response_time;
  int finish_time;
} process_stat;

#endif
