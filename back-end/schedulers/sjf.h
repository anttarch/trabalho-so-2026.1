#ifndef SJF_H
#define SJF_H

#include <vector>
#include "../internals/payload.h"

class SJFScheduler {
public:
    static void run(const payload &p, std::vector<int> *timeline);
};

#endif