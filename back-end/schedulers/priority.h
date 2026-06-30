#ifndef PRIORITY_H
#define PRIORITY_H

#include <vector>
#include "../internals/payload.h"

class PriorityScheduler {
public:
    static void run(const payload &p, std::vector<int> *timeline);
};

#endif