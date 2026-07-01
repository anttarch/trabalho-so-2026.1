#ifndef EDF_H
#define EDF_H
#include <vector>
#include "../internals/payload.h"

class EDFScheduler {
public:
    static void run(const payload &p, std::vector<int> *timeline);
};
#endif