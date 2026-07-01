#ifndef __CORE_H
#define __CORE_H

#include <nlohmann/json.hpp>

#include <vector>

#include "handling.h"
#include "payload.h"

using json = nlohmann::json;

typedef struct {
  std::vector<int> timeline;
  std::vector<process_stat> process_stats;
  double throughput;
  double idle_percentage;
  int preemptions;
  int context_switches;
} simulation_result;

class Simulator {
private:
  simulation_result result;

  void calculate_stats(const std::vector<process> &process_list, const payload *p);

public:
  // redireciona para o algoritmo certo
  void run(const payload &p);

  // serializa o resultado
  ordered_json process_result();
};

#endif
