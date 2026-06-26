#ifndef __CORE_H
#define __CORE_H

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

public:
  // redireciona para o algoritmo certo
  void run(payload &p);

  // serializa o resultado
  json process_result();
};

#endif
