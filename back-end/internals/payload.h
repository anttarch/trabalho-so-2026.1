#ifndef __PAYLOAD_H
#define __PAYLOAD_H

#include <nlohmann/json.hpp>

#include <string>
#include <vector>

#include "algorithms.h"

using namespace nlohmann;

typedef struct {
  int id; // id do processo
  std::string name; // nome do processo
  int absoluteArrivalTime; // tempo absoluto de chegada
  int burstTime; // tempo necessário para execução
  int priority; // prioridade
} process;

typedef struct {
  algorithms algorithm; // algoritmo
  int quantum; // tempo de quantum
  int overload; // tempo de sobrecarga
  std::vector<process> process_list;
} payload;

payload payload_from_json(basic_json<> &j);

#endif
