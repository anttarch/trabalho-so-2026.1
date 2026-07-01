#ifndef RR_H
#define RR_H

#include <vector>

#include "../internals/payload.h"

class RRScheduler {
public:
    static void run(const payload &p, std::vector<int> *timeline);
};

#endif