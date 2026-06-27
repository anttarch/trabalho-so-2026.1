# Trabalho de Sistemas Operacionais (trabalho-so-2026.1)

Este repositório contém o código-fonte do trabalho de Sistemas Operacionais.

---

## 🚀 Como Compilar e Rodar o Back-end

Navegue até a pasta do [back-end](./back-end):
```bash
cd back-end
```

Utilize o [Makefile](./back-end/Makefile) para compilar e rodar o servidor:

- **Compilar e rodar:**
  ```bash
  make
  ```
  *(O servidor iniciará em `http://127.0.0.1:8080`)*

- **Limpar arquivos compilados:**
  ```bash
  make clean
  ```

---

## 💻 Como Instalar e Rodar o Front-end

Navegue até a pasta do [front-end](./front-end):
```bash
cd front-end
```

Utilize o **npm** para gerenciar os pacotes e rodar a aplicação:

- **Instalar dependências:**
  ```bash
  npm install
  ```

- **Iniciar servidor de desenvolvimento (Vite):**
  ```bash
  npm run dev
  ```
  *(O link de acesso local será gerado no terminal, ex: `http://localhost:5173`)*

- **Gerar build de produção:**
  ```bash
  npm run build
  ```
