#ifndef __CFS_H
#define __CFS_H

#include <vector>

#include "../internals/payload.h"

class CFSScheduler {
    public:
        static void run(const payload &payload, std::vector<int> *timeline);
};

#endif
