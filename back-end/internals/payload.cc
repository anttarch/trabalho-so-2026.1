#include "payload.h"

process __process_from_json(basic_json<> &j) {
  process p;
  j["id"].get_to(p.id);
  j["name"].get_to(p.name);
  j["arrivalTime"].get_to(p.absolute_arrival_time);
  j["burstTime"].get_to(p.burst_time);
  j["priority"].get_to(p.priority);

  return p;
}

payload payload_from_json(basic_json<> &j) {
  payload p;

  p.algorithm = static_cast<algorithms>(j["algorithm"].get<int>());
  j["quantum"].get_to(p.quantum);
  j["overload"].get_to(p.overload);

  auto pj = j["processes"].get<std::vector<basic_json<>>>();
  std::vector<process> v;
  for (auto a : pj) {
    process pc = __process_from_json(a);
    v.emplace_back(pc);
  }

  p.process_list = v;

  return p;
}
