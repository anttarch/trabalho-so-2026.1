#ifndef __PAYLOAD_H
#define __PAYLOAD_H

#include <nlohmann/json.hpp>

#include <string>
#include <vector>

#include "algorithms.h"

using namespace nlohmann;

typedef struct {
  int id;
  std::string name;
  int arrivalTime;
  int burstTime;
  int priority;
} process;

typedef struct {
  algorithms algorithm;
  int quantum;
  int overload;
  std::vector<process> process_list;
} payload;

payload payload_from_json(basic_json<> &j);

#endif
