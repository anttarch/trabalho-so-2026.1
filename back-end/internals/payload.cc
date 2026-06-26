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

process _process_from_json(basic_json<> &j) {
  process p;
  j["id"].get_to(p.id);
  j["name"].get_to(p.name);
  j["arrivalTime"].get_to(p.arrivalTime);
  j["burstTime"].get_to(p.burstTime);
  j["priority"].get_to(p.priority);

  return p;
}

typedef struct {
  algorithms algorithm;
  int quantum;
  int overload;
  std::vector<process> process_list;
} payload;

payload payload_from_json(basic_json<> &j) {
  payload p;

  p.algorithm = static_cast<algorithms>(j["algorithm"].get<int>());
  j["quantum"].get_to(p.quantum);
  j["overload"].get_to(p.overload);

  auto pj = j["processes"].get<std::vector<basic_json<>>>();
  std::vector<process> v;
  for (auto a : pj) {
    process pc = _process_from_json(a);
    v.emplace_back(pc);
  }

  p.process_list = v;

  return p;
}
