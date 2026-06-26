#ifndef __SAMPLE_H
#define __SAMPLE_H

#include "../internals/core.h"
#include "../internals/payload.h"

class SampleScheduler {
    public:
        void run(payload &payload, simulation_result *result);
};

#endif
