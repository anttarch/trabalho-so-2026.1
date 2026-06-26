#ifndef __SAMPLE_H
#define __SAMPLE_H

#include <vector>

#include "../internals/payload.h"

class SampleScheduler {
    public:
        static void run(const payload &payload, std::vector<int> *timeline);
};

#endif
