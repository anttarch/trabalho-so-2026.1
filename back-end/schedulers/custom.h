#ifndef CUSTOM_H
#define CUSTOM_H
#include <vector>
#include "../internals/payload.h"

class CustomScheduler {
public:
    static void run(const payload &p, std::vector<int> *timeline);
};
#endif