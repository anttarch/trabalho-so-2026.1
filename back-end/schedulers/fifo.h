#ifndef FIFO_H
#define FIFO_H

#include <vector>

#include "../internals/payload.h"

class FIFOScheduler {
public:
    static void run(const payload &p, std::vector<int> *timeline);
};

#endif