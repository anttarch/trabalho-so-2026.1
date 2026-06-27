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
} simulation_result;

class Simulator {
private:
  simulation_result result;

  void calculate_stats(const std::vector<process> &process_list);

public:
  // redireciona para o algoritmo certo
  void run(const payload &p);

  // serializa o resultado
  ordered_json process_result();
};

#endif
