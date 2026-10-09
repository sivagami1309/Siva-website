cmake_minimum_required(VERSION 3.20)
project(siva_mart_backend LANGUAGES CXX)

find_package(Drogon CONFIG REQUIRED)
find_package(PostgreSQL REQUIRED)

set(CMAKE_CXX_STANDARD 20)

set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(siva_mart main.cpp)

target_compile_definitions(siva_mart PRIVATE SIVA_MART_WITH_DROGON=1)
target_link_libraries(siva_mart PRIVATE Drogon::Drogon PostgreSQL::PostgreSQL)

add_custom_command(TARGET siva_mart POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          "${CMAKE_CURRENT_SOURCE_DIR}/../frontend"
          "$<TARGET_FILE_DIR:siva_mart>/frontend")