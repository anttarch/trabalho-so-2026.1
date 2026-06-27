# Testando o Back-end do Simulador

O back-end do projeto é um servidor HTTP desenvolvido em C++ que expõe a rota POST `/simulate`. Esta rota é responsável por receber os processos e configurações do front-end, simular o agendamento de CPU e retornar a linha do tempo (timeline) da simulação junto com métricas estatísticas dos processos.

Este guia orienta como testar esse fluxo manualmente usando `curl` ou ferramentas visuais como **Postman**.

---

## 🚦 Endpoint de Simulação

- **URL:** `http://127.0.0.1:8080/simulate`
- **Método:** `POST`
- **Header:** `Content-Type: application/json`

---

## 🎛️ IDs dos Algoritmos de Agendamento

Ao enviar a requisição JSON, o campo `algorithm` deve conter o ID numérico correspondente ao algoritmo de agendamento de CPU. O mapeamento é definido em [algorithms.h](./back-end/internals/algorithms.h):

| ID | Algoritmo | Descrição |
|---|---|---|
| **0** | **FIFO** | First-In, First-Out |
| **1** | **SJF** | Shortest Job First |
| **2** | **RR** | Round-Robin |
| **3** | **PRIO** | Prioridade |
| **4** | **EDF** | Earliest Deadline First |
| **5** | **CFS** | Completely Fair Scheduler |
| **6** | **CUSTOM** | Algoritmo Customizado |

---

## 📥 Estrutura do JSON de Entrada (Request)

A requisição enviada pelo front-end possui os seguintes campos (mapeados em [payload.h](./back-end/internals/payload.h)):

*(Nota: Nenhum processo deve possuir ID igual a 0).*

```json
{
  "algorithm": 2,
  "quantum": 2,
  "overload": 1,
  "processes": [
    {
      "id": 1,
      "name": "P1",
      "arrivalTime": 0,
      "burstTime": 4,
      "priority": 1
    },
    {
      "id": 2,
      "name": "P2",
      "arrivalTime": 2,
      "burstTime": 3,
      "priority": 2
    }
  ]
}
```

### Detalhes dos Campos:
- **`algorithm`**: ID do algoritmo (0 a 6). Neste exemplo, usamos **2** para **RR** (Round-Robin).
- **`quantum`**: Tempo de quantum (usado no Round-Robin / CFS, etc.).
- **`overload`**: Tempo de sobrecarga para trocas de contexto.
- **`processes`**: Lista de processos contendo:
  - **`id`**: ID único do processo (número inteiro positivo maior que 0).
  - **`name`**: Nome de exibição do processo (string).
  - **`arrivalTime`**: Tempo de chegada na fila de prontos (inteiro).
  - **`burstTime`**: Tempo total estimado de CPU necessário (inteiro).
  - **`priority`**: Prioridade do processo (inteiro).

---

## 📤 Estrutura do JSON de Saída (Response)

O servidor responde com `status 201` contendo a seguinte estrutura JSON consistente com as configurações acima:

```json
{
  "timeline": [1, 1, -2, 2, 2, -2, 1, 1, -2, 2],
  "processStats": [
    {
      "id": 1,
      "waitingTime": 4,
      "turnaroundTime": 8,
      "responseTime": 0,
      "finishTime": 8
    },
    {
      "id": 2,
      "waitingTime": 7,
      "turnaroundTime": 8,
      "responseTime": 1,
      "finishTime": 10
    }
  ]
}
```

### Explicação dos Valores da Linha do Tempo (`timeline`):
- Um número inteiro $\ge 1$ representa o `id` do processo em execução naquele instante de tempo (ex: `1` e `2`).
- **`-1`**: Representa tempo ocioso (Idle).
- **`-2`**: Representa tempo de sobrecarga (Overload) gerado pelas preempções/trocas de contexto configuradas pelo parâmetro `overload`.

---

## 🛠️ Ferramentas para Teste

### 1. Usando o `curl` (Terminal)

Para fazer uma requisição rápida via terminal Linux ou Windows PowerShell:

```bash
curl -X POST http://127.0.0.1:8080/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": 2,
    "quantum": 2,
    "overload": 1,
    "processes": [
      {
        "id": 1,
        "name": "P1",
        "arrivalTime": 0,
        "burstTime": 4,
        "priority": 1
      },
      {
        "id": 2,
        "name": "P2",
        "arrivalTime": 2,
        "burstTime": 3,
        "priority": 2
      }
    ]
  }'
```

### 2. Usando o **Postman** (Interface Visual)

Para rodar o teste com uma ferramenta gráfica como o Postman:
1. Abra o Postman e crie uma nova aba de requisição.
2. Defina o método como **POST** e insira a URL `http://127.0.0.1:8080/simulate`.
3. Vá até a aba **Headers** e adicione:
   - Chave: `Content-Type`
   - Valor: `application/json`
4. Vá até a aba **Body**, selecione a opção **raw** e escolha o formato **JSON** no menu drop-down.
5. Cole o JSON de exemplo acima no editor de texto.
6. Clique no botão **Send**. A resposta com o JSON estruturado (`timeline` e `processStats`) deverá aparecer na aba inferior com status HTTP `201 Created`.
