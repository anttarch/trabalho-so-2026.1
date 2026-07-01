#include <httplib.h>
#include <nlohmann/json.hpp>

#include <iostream>
#include <string>

#include "internals/core.h"
#include "internals/payload.h"

using json = nlohmann::json;

static void add_cors_headers(httplib::Response &res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization");
  res.set_header("Access-Control-Max-Age", "86400");
}

int main() {
  httplib::Server server;

  server.Options("/.*", [](const auto &req, auto &res) {
    add_cors_headers(res);
    res.status = 204;
  });

  server.set_pre_routing_handler([](const auto &req, auto &res) {
    res.user_data.set("start", std::chrono::steady_clock::now());
    return httplib::Server::HandlerResponse::Unhandled;
  });

  server.set_logger([](const auto &req, const auto &res) {
    auto *start = res.user_data.template get<std::chrono::steady_clock::time_point>("start");
    auto elapsed = start
      ? std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::steady_clock::now() - *start).count()
      : 0;
    std::cout << req.method << " " << req.path
              << " " << res.status << " " << elapsed << "ms" << std::endl;
  });

  server.Post(
      "/simulate", [](const httplib::Request &req, httplib::Response &res) {
        try {
          add_cors_headers(res);
          auto in = json::parse(req.body);
          payload p = payload_from_json(in);

          Simulator sim;
          sim.run(p);

          ordered_json out = sim.process_result();

          res.status = 201;
          res.set_content(out.dump(), "application/json");
        } catch (const std::exception &e) {
          add_cors_headers(res);
          res.status = 400;
          res.set_content("{\"error\":\"invalid json\"}", "application/json");
        }
      });

  server.listen("127.0.0.1", 8080);
}
