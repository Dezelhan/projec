const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 8000;
const DB_PATH = "./database.db";

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Логирование всех запросов (для отладки)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`[${req.method}] ${req.path}`);
    console.log("Request path:", req.path);
    console.log("Request originalUrl:", req.originalUrl);
    console.log("Request query:", req.query);
    console.log("Request body:", req.body);
  }
  next();
});

// Настройка сессий
app.use(
  session({
    secret: "podrabotka-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Установите в true для HTTPS
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
    },
  }),
);

// Инициализация базы данных
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("Ошибка подключения к БД:", err);
        reject(err);
        return;
      }
      console.log("Подключено к SQLite базе данных");
    });

    // Создание таблиц
    db.serialize(() => {
      // Таблица пользователей
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                role TEXT NOT NULL DEFAULT 'job_seeker',
                phone TEXT,
                company TEXT,
                is_admin INTEGER DEFAULT 0,
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`,
        (err) => {
          if (err) {
            console.error("Ошибка создания таблицы users:", err);
            reject(err);
            return;
          }
        },
      );

      // Таблица вакансий
      db.run(
        `CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                location TEXT,
                salary TEXT,
                employer_id INTEGER,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employer_id) REFERENCES users(id)
            )`,
        (err) => {
          if (err) {
            console.error("Ошибка создания таблицы jobs:", err);
          }
        },
      );

      // Таблица откликов
      db.run(
        `CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                applicant_id INTEGER NOT NULL,
                message TEXT,
                status TEXT DEFAULT 'new',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES jobs(id),
                FOREIGN KEY (applicant_id) REFERENCES users(id)
            )`,
        (err) => {
          if (err) {
            console.error("Ошибка создания таблицы applications:", err);
          }
        },
      );

      // Создаем тестовых пользователей, если их нет
      db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
          console.error("Ошибка проверки пользователей:", err);
          resolve(db);
          return;
        }

        if (row.count === 0) {
          console.log("Создание тестовых пользователей...");
          const testPassword = bcrypt.hashSync("12345", 10);

          const testUsers = [
            [
              "jobseeker@example.com",
              testPassword,
              "Искатель работы",
              "job_seeker",
              0,
            ],
            [
              "employer@example.com",
              testPassword,
              "Работодатель",
              "employer",
              0,
            ],
            [
              "admin@example.com",
              testPassword,
              "Администратор",
              "job_seeker",
              1,
            ],
          ];

          const stmt = db.prepare(
            "INSERT INTO users (email, password, name, role, is_admin) VALUES (?, ?, ?, ?, ?)",
          );
          testUsers.forEach((user) => {
            stmt.run(user);
          });
          stmt.finalize();
          console.log("Тестовые пользователи созданы");
        }

        resolve(db);
      });
    });
  });
}

let db;

// Вспомогательная функция для отправки JSON
function sendJSON(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

// Валидация email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// API: Проверка сессии
app.get("/api/check_session.php", (req, res) => {
  if (!db) {
    sendJSON(res, {
      success: true,
      authenticated: false,
      user: null,
    });
    return;
  }

  if (req.session.user_id) {
    db.get(
      "SELECT id, email, name, role, phone, company, is_admin, registered_at FROM users WHERE id = ?",
      [req.session.user_id],
      (err, user) => {
        if (err || !user) {
          sendJSON(res, {
            success: true,
            authenticated: false,
            user: null,
          });
          return;
        }

        sendJSON(res, {
          success: true,
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name || "",
            role: user.role,
            isAdmin: user.is_admin === 1,
            phone: user.phone || "",
            company: user.company || "",
            registeredAt: user.registered_at,
          },
        });
      },
    );
  } else {
    sendJSON(res, {
      success: true,
      authenticated: false,
      user: null,
    });
  }
});

// API: Вход
app.post("/api/login.php", (req, res) => {
  if (!db) {
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  const { email, password, remember } = req.body;

  if (!email || !password) {
    sendJSON(res, { success: false, message: "Заполните все поля" }, 400);
    return;
  }

  if (!isValidEmail(email)) {
    sendJSON(res, { success: false, message: "Введите корректный email" }, 400);
    return;
  }

  db.get(
    "SELECT id, email, password, name, role, phone, company, is_admin, registered_at FROM users WHERE email = ?",
    [email],
    (err, user) => {
      if (err) {
        console.error("Ошибка входа:", err);
        sendJSON(
          res,
          { success: false, message: "Ошибка при входе. Попробуйте позже." },
          500,
        );
        return;
      }

      if (!user) {
        sendJSON(
          res,
          { success: false, message: "Неверный email или пароль" },
          401,
        );
        return;
      }

      // Проверяем пароль
      bcrypt.compare(password, user.password, (err, match) => {
        if (err) {
          console.error("Ошибка проверки пароля:", err);
          sendJSON(
            res,
            { success: false, message: "Ошибка при входе. Попробуйте позже." },
            500,
          );
          return;
        }

        if (!match) {
          sendJSON(
            res,
            { success: false, message: "Неверный email или пароль" },
            401,
          );
          return;
        }

        // Обновляем время последнего входа
        db.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [
          user.id,
        ]);

        // Создаем сессию
        req.session.user_id = user.id;
        req.session.user_email = user.email;
        req.session.user_name = user.name;
        req.session.user_role = user.role;
        req.session.user_is_admin = user.is_admin === 1;
        req.session.user_phone = user.phone || "";
        req.session.user_company = user.company || "";

        if (remember) {
          req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 дней
        }

        sendJSON(res, {
          success: true,
          message: "Вход выполнен успешно!",
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isAdmin: user.is_admin === 1,
            phone: user.phone || "",
            company: user.company || "",
            registeredAt: user.registered_at,
          },
        });
      });
    },
  );
});

// API: Регистрация
app.post("/api/register.php", (req, res) => {
  if (!db) {
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  const { email, password, repeatPassword, userType, name, phone, company } =
    req.body;

  if (!email || !password || !repeatPassword || !userType) {
    sendJSON(
      res,
      { success: false, message: "Заполните все обязательные поля" },
      400,
    );
    return;
  }

  if (!isValidEmail(email)) {
    sendJSON(res, { success: false, message: "Введите корректный email" }, 400);
    return;
  }

  if (password.length < 5) {
    sendJSON(
      res,
      { success: false, message: "Пароль должен быть не менее 5 символов" },
      400,
    );
    return;
  }

  if (password !== repeatPassword) {
    sendJSON(res, { success: false, message: "Пароли не совпадают" }, 400);
    return;
  }

  if (!["job_seeker", "employer"].includes(userType)) {
    sendJSON(
      res,
      { success: false, message: "Неверный тип пользователя" },
      400,
    );
    return;
  }

  const userName = name || email.split("@")[0];

  // Проверяем, существует ли пользователь
  db.get(
    "SELECT id FROM users WHERE email = ?",
    [email],
    (err, existingUser) => {
      if (err) {
        console.error("Ошибка проверки пользователя:", err);
        sendJSON(
          res,
          {
            success: false,
            message: "Ошибка при регистрации. Попробуйте позже.",
          },
          500,
        );
        return;
      }

      if (existingUser) {
        sendJSON(
          res,
          {
            success: false,
            message: "Пользователь с таким email уже существует",
          },
          400,
        );
        return;
      }

      // Хешируем пароль
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          console.error("Ошибка хеширования пароля:", err);
          sendJSON(
            res,
            {
              success: false,
              message: "Ошибка при регистрации. Попробуйте позже.",
            },
            500,
          );
          return;
        }

        // Создаем пользователя
        db.run(
          "INSERT INTO users (email, password, name, role, phone, company, registered_at, last_login) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
          [
            email,
            hashedPassword,
            userName,
            userType,
            phone || null,
            company || null,
          ],
          function (err) {
            if (err) {
              console.error("Ошибка создания пользователя:", err);
              sendJSON(
                res,
                {
                  success: false,
                  message: "Ошибка при регистрации. Попробуйте позже.",
                },
                500,
              );
              return;
            }

            const userId = this.lastID;

            // Создаем сессию
            req.session.user_id = userId;
            req.session.user_email = email;
            req.session.user_name = userName;
            req.session.user_role = userType;
            req.session.user_is_admin = false;
            req.session.user_phone = phone || "";
            req.session.user_company = company || "";

            // Получаем данные созданного пользователя
            db.get(
              "SELECT id, email, name, role, phone, company, is_admin, registered_at FROM users WHERE id = ?",
              [userId],
              (err, user) => {
                if (err || !user) {
                  sendJSON(
                    res,
                    {
                      success: false,
                      message: "Ошибка при регистрации. Попробуйте позже.",
                    },
                    500,
                  );
                  return;
                }

                sendJSON(res, {
                  success: true,
                  message: "Регистрация успешна!",
                  user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isAdmin: user.is_admin === 1,
                    phone: user.phone || "",
                    company: user.company || "",
                    registeredAt: user.registered_at,
                  },
                });
              },
            );
          },
        );
      });
    },
  );
});

// API: Выход
app.post("/api/logout.php", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Ошибка выхода:", err);
    }
    sendJSON(res, {
      success: true,
      message: "Вы вышли из аккаунта",
    });
  });
});

app.get("/api/logout.php", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Ошибка выхода:", err);
    }
    sendJSON(res, {
      success: true,
      message: "Вы вышли из аккаунта",
    });
  });
});

// API: Создание вакансии
app.post("/api/jobs.php", (req, res) => {
  console.log("POST /api/jobs.php - запрос получен");
  console.log("Body:", req.body);
  console.log("Session user_id:", req.session.user_id);
  console.log("Session user_role:", req.session.user_role);
  console.log("DB initialized:", !!db);

  if (!db) {
    console.error("База данных не инициализирована");
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  if (!req.session.user_id) {
    console.log("Пользователь не авторизован");
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  const user = {
    id: req.session.user_id,
    role: req.session.user_role,
  };

  console.log("User role:", user.role);

  if (user.role !== "employer") {
    console.log("Пользователь не работодатель");
    sendJSON(
      res,
      {
        success: false,
        message: "Только работодатели могут создавать вакансии",
      },
      403,
    );
    return;
  }

  const {
    title,
    description,
    location,
    salary,
    category,
    requirements,
    benefits,
    schedule,
    contacts,
  } = req.body;

  console.log("Job data:", { title, description, location, salary });

  if (!title || !description || !location || !salary) {
    console.log("Не все поля заполнены");
    sendJSON(
      res,
      { success: false, message: "Заполните все обязательные поля" },
      400,
    );
    return;
  }

  db.run(
    "INSERT INTO jobs (title, description, location, salary, employer_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))",
    [title, description, location, salary, user.id],
    function (err) {
      if (err) {
        console.error("Ошибка создания вакансии:", err);
        sendJSON(
          res,
          {
            success: false,
            message: "Ошибка при создании вакансии. Попробуйте позже.",
          },
          500,
        );
        return;
      }

      sendJSON(res, {
        success: true,
        message: "Вакансия успешно создана!",
        job: {
          id: this.lastID,
          title,
          description,
          location,
          salary,
          employer_id: user.id,
        },
      });
    },
  );
});

// API: Получение вакансий
app.get("/api/jobs.php", (req, res) => {
  if (!db) {
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  db.all(
    "SELECT j.*, u.email as employer_email, u.name as employer_name, u.phone as employer_phone, u.company as employer_company FROM jobs j LEFT JOIN users u ON j.employer_id = u.id WHERE j.is_active = 1 ORDER BY j.created_at DESC",
    [],
    (err, jobs) => {
      if (err) {
        console.error("Ошибка получения вакансий:", err);
        sendJSON(
          res,
          { success: false, message: "Ошибка при получении вакансий" },
          500,
        );
        return;
      }

      sendJSON(res, {
        success: true,
        jobs: jobs || [],
      });
    },
  );
});

// API: Получение вакансий работодателя
app.get("/api/my-jobs.php", (req, res) => {
  if (!req.session.user_id) {
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  if (req.session.user_role !== "employer") {
    sendJSON(res, { success: false, message: "Только для работодателей" }, 403);
    return;
  }

  db.all(
    "SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC",
    [req.session.user_id],
    (err, jobs) => {
      if (err) {
        console.error("Ошибка получения вакансий:", err);
        sendJSON(
          res,
          { success: false, message: "Ошибка при получении вакансий" },
          500,
        );
        return;
      }

      sendJSON(res, {
        success: true,
        jobs: jobs || [],
      });
    },
  );
});

// API: Удаление вакансии
app.delete("/api/jobs.php", (req, res) => {
  console.log("DELETE /api/jobs.php - запрос получен");

  if (!req.session.user_id) {
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  const jobId = req.body.job_id || req.body.id;

  if (!jobId) {
    sendJSON(res, { success: false, message: "Укажите ID вакансии" }, 400);
    return;
  }

  // Проверяем, существует ли вакансия
  db.get(
    "SELECT id, employer_id FROM jobs WHERE id = ?",
    [jobId],
    (err, job) => {
      if (err || !job) {
        sendJSON(res, { success: false, message: "Вакансия не найдена" }, 404);
        return;
      }

      // Проверяем права: только владелец или админ
      const isOwner = job.employer_id === req.session.user_id;
      const isAdmin = req.session.user_is_admin === true;

      if (!isOwner && !isAdmin) {
        sendJSON(
          res,
          { success: false, message: "Нет прав на удаление этой вакансии" },
          403,
        );
        return;
      }

      // Удаляем вакансию
      db.run("DELETE FROM jobs WHERE id = ?", [jobId], function (err) {
        if (err) {
          console.error("Ошибка удаления вакансии:", err);
          sendJSON(
            res,
            {
              success: false,
              message: "Ошибка при удалении вакансии",
            },
            500,
          );
          return;
        }

        sendJSON(res, {
          success: true,
          message: "Вакансия успешно удалена",
        });
      });
    },
  );
});


// API: Создание отклика
app.post("/api/applications.php", (req, res) => {
  console.log("POST /api/applications.php - запрос получен");
  console.log("Body:", req.body);
  console.log("Session user_id:", req.session.user_id);
  console.log("Session user_role:", req.session.user_role);
  console.log("DB initialized:", !!db);

  if (!db) {
    console.error("База данных не инициализирована");
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  if (!req.session.user_id) {
    console.log("Пользователь не авторизован");
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  const user = {
    id: req.session.user_id,
    role: req.session.user_role,
  };

  if (user.role === "employer") {
    sendJSON(
      res,
      {
        success: false,
        message: "Работодатели не могут откликаться на вакансии",
      },
      403,
    );
    return;
  }

  const { job_id, message } = req.body;

  if (!job_id) {
    sendJSON(res, { success: false, message: "Укажите вакансию" }, 400);
    return;
  }

  // Проверяем, существует ли вакансия
  db.get(
    "SELECT id FROM jobs WHERE id = ? AND is_active = 1",
    [job_id],
    (err, job) => {
      if (err || !job) {
        sendJSON(res, { success: false, message: "Вакансия не найдена" }, 404);
        return;
      }

      // Проверяем, не откликался ли уже
      db.get(
        "SELECT id FROM applications WHERE job_id = ? AND applicant_id = ?",
        [job_id, user.id],
        (err, existing) => {
          if (err) {
            console.error("Ошибка проверки отклика:", err);
            sendJSON(
              res,
              { success: false, message: "Ошибка при создании отклика" },
              500,
            );
            return;
          }

          if (existing) {
            sendJSON(
              res,
              { success: false, message: "Вы уже откликались на эту вакансию" },
              400,
            );
            return;
          }

          // Создаем отклик
          db.run(
            "INSERT INTO applications (job_id, applicant_id, message, status, created_at) VALUES (?, ?, ?, 'new', datetime('now'))",
            [job_id, user.id, message || ""],
            function (err) {
              if (err) {
                console.error("Ошибка создания отклика:", err);
                sendJSON(
                  res,
                  {
                    success: false,
                    message: "Ошибка при создании отклика. Попробуйте позже.",
                  },
                  500,
                );
                return;
              }

              sendJSON(res, {
                success: true,
                message: "Ваш отклик успешно отправлен!",
                application: {
                  id: this.lastID,
                  job_id,
                  applicant_id: user.id,
                  message: message || "",
                  status: "new",
                },
              });
            },
          );
        },
      );
    },
  );
});

// API: Получение откликов пользователя (для искателя работы)
app.get("/api/my-applications.php", (req, res) => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("GET /api/my-applications.php - запрос получен");
  console.log("Request path:", req.path);
  console.log("Request method:", req.method);
  console.log("Session user_id:", req.session.user_id);
  console.log("Session user_email:", req.session.user_email);
  console.log("DB initialized:", !!db);

  if (!db) {
    console.error("База данных не инициализирована");
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  if (!req.session.user_id) {
    console.log("Пользователь не авторизован");
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  console.log("Запрос откликов для пользователя ID:", req.session.user_id);

  db.all(
    `SELECT a.*, j.title as job_title, j.location, j.salary, j.employer_id,
            u.email as employer_email, u.name as employer_name, u.phone as employer_phone
            FROM applications a
            LEFT JOIN jobs j ON a.job_id = j.id
            LEFT JOIN users u ON j.employer_id = u.id
            WHERE a.applicant_id = ?
            ORDER BY a.created_at DESC`,
    [req.session.user_id],
    (err, applications) => {
      if (err) {
        console.error("Ошибка получения откликов:", err);
        sendJSON(
          res,
          { success: false, message: "Ошибка при получении откликов" },
          500,
        );
        return;
      }

      console.log("Найдено откликов в БД:", applications?.length || 0);

      // Преобразуем данные для совместимости с фронтендом
      const formatted = applications.map((app) => ({
        id: app.id,
        jobId: app.job_id,
        jobTitle: app.job_title,
        location: app.location,
        salary: app.salary,
        message: app.message || "",
        status: app.status || "new",
        createdAt: app.created_at,
        applicantEmail: req.session.user_email || "",
        applicantName: req.session.user_name || "",
      }));

      console.log("Отформатировано откликов:", formatted.length);

      sendJSON(res, {
        success: true,
        applications: formatted || [],
      });
    },
  );
});

// API: Получение откликов на вакансию (для работодателя)
app.get("/api/applications.php", (req, res) => {
  if (!db) {
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  if (!req.session.user_id) {
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  const job_id = req.query.job_id;

  if (!job_id) {
    sendJSON(res, { success: false, message: "Укажите ID вакансии" }, 400);
    return;
  }

  // Проверяем, что пользователь - владелец вакансии
  db.get("SELECT employer_id FROM jobs WHERE id = ?", [job_id], (err, job) => {
    if (err || !job) {
      sendJSON(res, { success: false, message: "Вакансия не найдена" }, 404);
      return;
    }

    if (job.employer_id !== req.session.user_id) {
      sendJSON(
        res,
        { success: false, message: "Нет доступа к этой вакансии" },
        403,
      );
      return;
    }

    db.all(
      `SELECT a.*, u.email as applicant_email, u.name as applicant_name, u.phone as applicant_phone 
                FROM applications a 
                LEFT JOIN users u ON a.applicant_id = u.id 
                WHERE a.job_id = ? 
                ORDER BY a.created_at DESC`,
      [job_id],
      (err, applications) => {
        if (err) {
          console.error("Ошибка получения откликов:", err);
          sendJSON(
            res,
            { success: false, message: "Ошибка при получении откликов" },
            500,
          );
          return;
        }

        // Преобразуем данные для совместимости с фронтендом
        const formatted = applications.map((app) => ({
          id: app.id,
          jobId: app.job_id,
          applicantEmail: app.applicant_email,
          applicantName: app.applicant_name,
          applicantPhone: app.applicant_phone,
          message: app.message || "",
          status: app.status || "new",
          createdAt: app.created_at,
        }));

        sendJSON(res, {
          success: true,
          applications: formatted || [],
        });
      },
    );
  });
});

// API: Удаление отклика
app.delete("/api/applications.php", (req, res) => {
  console.log("DELETE /api/applications.php - запрос получен");
  console.log("Body:", req.body);
  console.log("Query:", req.query);
  console.log("Session user_id:", req.session.user_id);
  console.log("DB initialized:", !!db);

  if (!db) {
    sendJSON(
      res,
      { success: false, message: "База данных не инициализирована" },
      503,
    );
    return;
  }

  if (!req.session.user_id) {
    sendJSON(res, { success: false, message: "Необходима авторизация" }, 401);
    return;
  }

  // Получаем ID отклика из body или query
  const applicationId =
    req.body.application_id ||
    req.query.application_id ||
    req.body.id ||
    req.query.id;

  if (!applicationId) {
    sendJSON(res, { success: false, message: "Укажите ID отклика" }, 400);
    return;
  }

  // Проверяем, существует ли отклик и принадлежит ли он текущему пользователю (искателю работы)
  // Или пользователь - работодатель этой вакансии
  db.get(
    `SELECT a.*, j.employer_id 
            FROM applications a 
            LEFT JOIN jobs j ON a.job_id = j.id 
            WHERE a.id = ?`,
    [applicationId],
    (err, application) => {
      if (err) {
        console.error("Ошибка проверки отклика:", err);
        sendJSON(
          res,
          { success: false, message: "Ошибка при удалении отклика" },
          500,
        );
        return;
      }

      if (!application) {
        sendJSON(res, { success: false, message: "Отклик не найден" }, 404);
        return;
      }

      // Проверяем права доступа: пользователь должен быть либо соискателем, либо работодателем
      const isApplicant = application.applicant_id === req.session.user_id;
      const isEmployer = application.employer_id === req.session.user_id;

      if (!isApplicant && !isEmployer) {
        sendJSON(
          res,
          { success: false, message: "Нет прав на удаление этого отклика" },
          403,
        );
        return;
      }

      // Удаляем отклик
      console.log("Удаление отклика ID:", applicationId);
      db.run(
        "DELETE FROM applications WHERE id = ?",
        [applicationId],
        function (err) {
          if (err) {
            console.error("Ошибка удаления отклика:", err);
            sendJSON(
              res,
              {
                success: false,
                message: "Ошибка при удалении отклика. Попробуйте позже.",
              },
              500,
            );
            return;
          }

          console.log("Отклик успешно удален");
          sendJSON(res, {
            success: true,
            message: "Отклик успешно удален",
          });
        },
      );
    },
  );
});

// Статические файлы (исключаем папку api из статики)
app.use((req, res, next) => {
  // Если запрос к API, не обрабатываем как статический файл
  if (req.path.startsWith("/api/")) {
    // Если дошли сюда, значит API маршрут не найден
    console.error("API маршрут не найден:", req.method, req.path);
    sendJSON(
      res,
      { success: false, message: "API endpoint не найден: " + req.path },
      404,
    );
    return;
  }
  // Обрабатываем как статический файл
  express.static(__dirname)(req, res, next);
});

// Запуск сервера после инициализации БД
initDatabase()
  .then((database) => {
    db = database;
    console.log("✓ База данных инициализирована");

    // Проверяем зарегистрированные маршруты (только если роутер инициализирован)
    try {
      if (app._router && app._router.stack) {
        console.log("\nЗарегистрированные API маршруты:");
        const routes = [];
        app._router.stack.forEach((middleware) => {
          if (middleware.route) {
            const methods = Object.keys(middleware.route.methods)
              .join(", ")
              .toUpperCase();
            routes.push(`${methods} ${middleware.route.path}`);
          }
        });
        if (routes.length > 0) {
          routes.forEach((route) => console.log("  -", route));
        } else {
          console.log("  (маршруты будут зарегистрированы при первом запросе)");
        }
        console.log("");
      }
    } catch (err) {
      // Игнорируем ошибки при проверке маршрутов
      console.log("\nМаршруты будут зарегистрированы при запуске сервера\n");
    }

    app.listen(PORT, () => {
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
      console.log(`  Сервер запущен на http://localhost:${PORT}`);
      console.log(`  API endpoints доступны`);
      console.log(
        `═══════════════════════════════════════════════════════════`,
      );
    });
  })
  .catch((err) => {
    console.error("Ошибка инициализации БД:", err);
    process.exit(1);
  });
