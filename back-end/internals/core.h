#include <vector>

#include "payload.h"

using json = nlohmann::json;

typedef enum {
    IDLE = -1,
    OVERLOAD = -2
} CPUTimeline;

typedef struct {
    int id;
    int waitingTime;
    int turnaroundTime;
    int responseTime;
    int finishTime;
} process_stat;

typedef struct {
    std::vector<int> timeline;
    std::vector<process_stat> process_stats;
} simulation_result;

class Simulation {
    simulation_result result;

    public:
        // redireciona para o algoritmo certo
        void run(payload &p);

        // serializa o resultado
        json process_result();
};
