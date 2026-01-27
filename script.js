const STORAGE_KEYS = {
    USERS: 'podrabotka_users',
    JOBS: 'podrabotka_jobs',
    APPLICATIONS: 'podrabotka_applications',
    CURRENT_USER: 'podrabotka_current_user'
};

// API endpoints
const API_BASE = 'api/';

const USER_ROLES = {
    JOB_SEEKER: 'job_seeker',
    EMPLOYER: 'employer'
};

let currentUser = null;

// ========== ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Инициализация системы Podrabotka...');

    // Проверяем сессию на сервере
    await checkSession();

    createTestData();

    currentUser = await getCurrentUser();
    console.log('Текущий пользователь при загрузке:', currentUser);


    const currentPage = window.location.pathname.split('/').pop();


    if (currentPage === 'profil.html') {
        if (!currentUser) {
            showNotification('Для доступа к профилю необходимо войти в систему', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }
    }


    if (currentPage === 'login.html' || currentPage === 'register.html') {
        if (currentUser) {
            showNotification('Вы уже авторизованы', 'info');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    }


    if (currentPage === 'create-job.html') {
        if (!currentUser) {
            showNotification('Для создания вакансии необходимо войти в систему', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }
        if (currentUser.role !== USER_ROLES.EMPLOYER) {
            showNotification('Только работодатели могут создавать вакансии', 'warning');
            setTimeout(() => {
                window.location.href = 'jobs.html';
            }, 1500);
            return;
        }
    }


    if (currentPage === 'my-jobs.html') {
        if (!currentUser) {
            showNotification('Для доступа необходимо войти в систему', 'warning');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
            return;
        }
        if (currentUser.role !== USER_ROLES.EMPLOYER) {
            showNotification('Эта страница доступна только работодателям', 'warning');
            setTimeout(() => {
                window.location.href = 'profil.html';
            }, 1500);
            return;
        }
    }


    if (currentPage === 'index.html' || currentPage === 'jobs.html' || currentPage === 'contact.html') {
        initAuthSystem();
        initAnimations();
        initContactForm();
        
        setTimeout(async () => await updateUserMenu(), 100);
        await updateJobCards();


        if (!localStorage.getItem('podrabotka_welcome_shown')) {
            setTimeout(() => {
                showNotification('Добро пожаловать на Podrabotka! Найди подработку за 5 минут.', 'info');
                localStorage.setItem('podrabotka_welcome_shown', 'true');
            }, 1500);
        }
    }
});

// ========== СИСТЕМА АВТОРИЗАЦИИ ==========
function initAuthSystem() {
    console.log('Инициализация системы авторизации...');


    updateUserMenu();


    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuToggle && userDropdown) {
        console.log('Настройка выпадающего меню пользователя...');

        userMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });


        document.addEventListener('click', function(e) {
            if (userMenuToggle && userDropdown) {
                if (!userMenuToggle.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.remove('show');
                }
            }
        });
    }
}

// ========== ФУНКЦИИ АВТОРИЗАЦИИ ==========
// Проверка сессии на сервере
async function checkSession() {
    try {
        const response = await fetch(API_BASE + 'check_session.php', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.authenticated && data.user) {
            currentUser = data.user;
            
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
            return data.user;
        } else {
            currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
            return null;
        }
    } catch (error) {
        console.error('Ошибка при проверке сессии:', error);
        return null;
    }
}

// Получение текущего пользователя
async function getCurrentUser() {
    // Сначала проверяем сессию на сервере
    const serverUser = await checkSession();
    if (serverUser) {
        return serverUser;
    }
    
    // Если нет сессии, пробуем получить из localStorage (для совместимости)
    try {
        const fromLocal = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
        if (fromLocal) {
            // Проверяем сессию еще раз
            return await checkSession();
        }
        return null;
    } catch (error) {
        console.error('Ошибка при загрузке пользователя:', error);
        return null;
    }
}

async function updateUserMenu() {
    console.log('Обновление меню пользователя...');

    // Если currentUser еще не загружен, загружаем его
    if (!currentUser) {
        currentUser = await getCurrentUser();
    }
    
    const guestMenu = document.getElementById('guestMenu');
    const userMenu = document.getElementById('userMenu');
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');
    const employerLink = document.getElementById('employerLink');
    const employerLinkJobs = document.getElementById('employerLinkJobs');
    const employerLinkContact = document.getElementById('employerLinkContact');

    if (!guestMenu || !userMenu) {
        console.log('Элементы меню не найдены');
        return;
    }

    if (currentUser) {
        console.log('Пользователь авторизован:', currentUser.email);


        guestMenu.style.display = 'none';
        userMenu.style.display = 'block';

        if (userEmail) {
            userEmail.textContent = currentUser.email;
        }

        if (userRole) {
            if (currentUser.isAdmin) {
                userRole.textContent = 'Администратор';
            } else if (currentUser.role === USER_ROLES.EMPLOYER) {
                userRole.textContent = 'Работодатель';
            } else {
                userRole.textContent = 'Искатель работы';
            }
        }


        if (employerLink && currentUser.role === USER_ROLES.EMPLOYER) {
            employerLink.style.display = 'block';
        }
        if (employerLinkJobs && currentUser.role === USER_ROLES.EMPLOYER) {
            employerLinkJobs.style.display = 'block';
        }
        if (employerLinkContact && currentUser.role === USER_ROLES.EMPLOYER) {
            employerLinkContact.style.display = 'block';
        }


        const userIcon = document.querySelector('.register-icon i');
        if (userIcon) {
            userIcon.className = 'fas fa-user-check';
            userIcon.style.color = '#bb86fc';
        }
    } else {
        console.log('Пользователь не авторизован');


        guestMenu.style.display = 'block';
        userMenu.style.display = 'none';


        if (employerLink) {
            employerLink.style.display = 'none';
        }
        if (employerLinkJobs) {
            employerLinkJobs.style.display = 'none';
        }
        if (employerLinkContact) {
            employerLinkContact.style.display = 'none';
        }


        const userIcon = document.querySelector('.register-icon i');
        if (userIcon) {
            userIcon.className = 'fas fa-user-circle';
            userIcon.style.color = '';
        }
    }
}

async function loginUser(email, password, remember = false) {
    console.log('Попытка входа пользователя:', email);

    try {
        const response = await fetch(API_BASE + 'login.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email,
                password: password,
                remember: remember
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.user) {
            console.log('Вход успешен:', data.user);
            currentUser = data.user;
            
            // Сохраняем в localStorage для совместимости
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
            
            updateUserMenu();
            return true;
        } else {
            console.log('Вход не удался:', data.message);
            showNotification(data.message || 'Ошибка при входе', 'error');
            return false;
        }
    } catch (error) {
        console.error('Ошибка при входе:', error);
        showNotification('Ошибка подключения к серверу. Проверьте подключение к интернету.', 'error');
        return false;
    }
}

async function registerUser(email, password, repeatPassword, userType, remember = false, additionalData = {}) {
    console.log('Регистрация нового пользователя:', email, 'тип:', userType);

    // Валидация на клиенте
    if (!email || !password || !repeatPassword || !userType) {
        showNotification('Заполните все поля', 'error');
        return false;
    }

    if (!isValidEmail(email)) {
        showNotification('Введите корректный email', 'error');
        return false;
    }

    if (password.length < 5) {
        showNotification('Пароль должен быть не менее 5 символов', 'error');
        return false;
    }

    if (password !== repeatPassword) {
        showNotification('Пароли не совпадают', 'error');
        return false;
    }

    if (![USER_ROLES.JOB_SEEKER, USER_ROLES.EMPLOYER].includes(userType)) {
        showNotification('Неверный тип пользователя', 'error');
        return false;
    }

    try {
        const response = await fetch(API_BASE + 'register.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email,
                password: password,
                repeatPassword: repeatPassword,
                userType: userType,
                name: additionalData.name || email.split('@')[0],
                phone: additionalData.phone || '',
                company: additionalData.company || ''
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.user) {
            console.log('Регистрация успешна:', data.user);
            currentUser = data.user;
            
            // Сохраняем в localStorage для совместимости
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));
            
            updateUserMenu();

            let welcomeMessage = 'Добро пожаловать! ';
            if (userType === USER_ROLES.EMPLOYER) {
                welcomeMessage += 'Теперь вы можете размещать вакансии и находить сотрудников.';
            } else {
                welcomeMessage += 'Теперь вы можете откликаться на вакансии и находить подработку.';
            }

            showNotification(welcomeMessage, 'success');
            return true;
        } else {
            showNotification(data.message || 'Ошибка при регистрации', 'error');
            return false;
        }
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        showNotification('Ошибка при регистрации. Попробуйте позже.', 'error');
        return false;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function logout() {
    console.log('Выход пользователя');

    try {
        const response = await fetch(API_BASE + 'logout.php', {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();
        
        // Очищаем локальное хранилище
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        currentUser = null;

        updateUserMenu();

        showNotification(data.message || 'Вы вышли из аккаунта', 'info');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        // В любом случае очищаем локальное хранилище
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        currentUser = null;
        updateUserMenu();
        showNotification('Вы вышли из аккаунта', 'info');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    }
}

// ========== СИСТЕМА ВАКАНСИЙ ==========
async function openModal(cardElement) {
    console.log('Открытие модального окна для вакансии');

    const user = await getCurrentUser();

    if (!user) {
        showNotification('Для отклика необходимо войти в систему', 'warning');
        setTimeout(() => {
            if (confirm('Хотите войти сейчас?')) {
                window.location.href = 'login.html';
            }
        }, 300);
        return;
    }

    if (user.role === USER_ROLES.EMPLOYER) {
        showNotification('Работодатели не могут откликаться на вакансии', 'warning');
        return;
    }

    const jobTitle = cardElement.dataset.job;
    const location = cardElement.dataset.place;
    const salary = cardElement.dataset.salary;
    const jobId = parseInt(cardElement.dataset.jobId);

    console.log('Данные карточки:', {
        jobTitle,
        location,
        salary,
        jobId,
        dataset: cardElement.dataset
    });

    if (!jobId || isNaN(jobId)) {
        console.error('Ошибка: не указан ID вакансии или он не является числом');
        showNotification('Ошибка: не указан ID вакансии. Попробуйте обновить страницу.', 'error');
        return;
    }

    console.log('Вакансия:', jobTitle, 'ID:', jobId);

    const message = prompt(
        `Отклик на вакансию: ${jobTitle}\n` +
        ` ${location}\n` +
        ` ${salary}\n\n` +
        `Напишите сопроводительное сообщение (необязательно):`,
        `Здравствуйте! Меня зовут ${user.name || user.email.split('@')[0]}. Заинтересовала вакансия, готов обсудить детали.`
    );

    if (message === null) {
        console.log('Пользователь отменил отклик');
        return;
    }

    // Отправляем отклик на сервер
    console.log('Отправка отклика на сервер...', {
        job_id: jobId,
        message: message || ''
    });

    try {
        const response = await fetch(API_BASE + 'applications.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                job_id: jobId,
                message: message || ''
            })
        });

        console.log('Ответ сервера:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка ответа сервера:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        console.log('Данные ответа:', data);

        if (data.success) {
            showNotification('Ваш отклик успешно отправлен! Работодатель свяжется с вами.', 'success');
            await updateApplicationStats();
        } else {
            console.error('Ошибка от сервера:', data.message);
            // Если пользователь уже откликался, показываем информационное сообщение
            if (data.message && data.message.includes('уже откликались')) {
                showNotification('Вы уже откликались на эту вакансию', 'info');
            } else {
                showNotification(data.message || 'Ошибка при отправке отклика', 'error');
            }
        }
    } catch (error) {
        console.error('Ошибка при отправке отклика:', error);
        showNotification('Ошибка подключения к серверу. Проверьте подключение к интернету.', 'error');
    }
}

async function updateJobCards() {
    console.log('Обновление карточек вакансий...');

    const jobCards = document.querySelectorAll('.cards-jobs[data-job]');
    
    // Загружаем вакансии из базы данных
    let allJobs = [];
    try {
        const response = await fetch(API_BASE + 'jobs.php', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                allJobs = data.jobs || [];
                // Сохраняем в localStorage для совместимости со старым кодом
                localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(allJobs));
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки вакансий:', error);
        // Fallback на localStorage если API недоступен
        allJobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
    }

    console.log('Найдено карточек:', jobCards.length);
    console.log('Всего вакансий в базе:', allJobs.length);

    jobCards.forEach((card, index) => {
        const jobTitle = card.dataset.job;
        const location = card.dataset.place;
        const salary = card.dataset.salary;

        const job = allJobs.find(j =>
            j.title === jobTitle &&
            j.location === location &&
            j.salary === salary
        );

        if (job) {
            card.dataset.jobId = job.id;
            console.log(`Карточка ${index + 1}: ID вакансии установлен - ${job.id}`);
        } else {
            card.dataset.jobId = Date.now() + index;
            console.log(`Карточка ${index + 1}: временный ID установлен - ${card.dataset.jobId}`);
        }

        if (!card.onclick) {
            card.onclick = function() { openModal(this); };
        }
    });
}

async function updateApplicationStats() {
    const user = await getCurrentUser();
    if (!user) return;

    try {
        const applications = await getUserApplications();
        console.log(`Всего откликов пользователя: ${applications.length}`);
        
        // Обновляем статистику в профиле, если страница открыта
        if (document.getElementById('statApplications')) {
            document.getElementById('statApplications').textContent = applications.length;
            document.getElementById('statActive').textContent = applications.filter(app => app.status === 'new' || app.status === 'active').length;
            document.getElementById('statCompleted').textContent = applications.filter(app => app.status === 'completed').length;
        }
    } catch (error) {
        console.error('Ошибка обновления статистики откликов:', error);
    }
}

// ========== СИСТЕМА УВЕДОМЛЕНИЙ ==========
function showNotification(message, type = 'info') {
    console.log(`Показ уведомления (${type}):`, message);


    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => {
        if (n.parentElement) n.remove();
    });


    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle'
    };

    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(notification);

    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'notificationSlideIn 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// ========== АНИМАЦИИ ==========
function initAnimations() {
    console.log('Инициализация анимаций...');

    const animateElements = document.querySelectorAll('.animate-on-scroll');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                const delay = element.dataset.delay || '0s';

                element.style.transitionDelay = delay;
                element.classList.add('animated');
                observer.unobserve(element);

                console.log(`Анимация запущена для элемента с задержкой ${delay}`);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    animateElements.forEach(element => {
        observer.observe(element);
    });

    console.log('Анимации инициализированы для', animateElements.length, 'элементов');
}

// ========== ФОРМА КОНТАКТОВ ==========
function initContactForm() {
    console.log('Инициализация формы контактов...');

    const contactForm = document.querySelector('form[onsubmit*="submitContactForm"]');
    if (contactForm) {
        contactForm.addEventListener('submit', submitContactForm);
        console.log('Форма контактов инициализирована');
    }
}

async function submitContactForm(event) {
    event.preventDefault();
    console.log('Отправка формы контактов');

    const user = await getCurrentUser();
    const name = event.target.querySelector('input[type="text"]').value;
    const email = event.target.querySelector('input[type="email"]').value;

    if (!user && (!name || !email)) {
        showNotification('Пожалуйста, заполните все поля или войдите в систему', 'warning');
        return;
    }

    showNotification('Спасибо! Ваше сообщение отправлено. Ответим в течение 2 часов.', 'success');
    event.target.reset();
    console.log('Форма контактов отправлена');
}


function createTestData() {
    console.log('Создание тестовых данных...');

    // Тестовые пользователи
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    console.log('Текущие пользователи:', users.length);

    // Тестовый искатель работы
    const testJobSeekerExists = users.some(user => user.email === 'jobseeker@example.com');
    if (!testJobSeekerExists) {
        const testJobSeeker = {
            id: 1,
            email: 'jobseeker@example.com',
            password: '12345',
            role: USER_ROLES.JOB_SEEKER,
            name: 'Иван Петров',
            phone: '+7 (999) 123-45-67',
            company: '',
            isAdmin: false,
            registeredAt: new Date('2024-01-15').toISOString(),
            lastLogin: null,
            profileComplete: true
        };
        users.push(testJobSeeker);
        console.log('Тестовый искатель работы создан');
    }

    // Тестовый работодатель
    const testEmployerExists = users.some(user => user.email === 'employer@example.com');
    if (!testEmployerExists) {
        const testEmployer = {
            id: 2,
            email: 'employer@example.com',
            password: '12345',
            role: USER_ROLES.EMPLOYER,
            name: 'Анна Сидорова',
            phone: '+7 (999) 987-65-43',
            company: 'Кофейня "Уютная"',
            isAdmin: false,
            registeredAt: new Date('2024-02-20').toISOString(),
            lastLogin: null,
            profileComplete: true
        };
        users.push(testEmployer);
        console.log('Тестовый работодатель создан');
    }


    const testAdminExists = users.some(user => user.email === 'admin@example.com');
    if (!testAdminExists) {
        const testAdmin = {
            id: 3,
            email: 'admin@example.com',
            password: 'admin123',
            role: USER_ROLES.JOB_SEEKER,
            name: 'Администратор',
            phone: '+7 (999) 000-00-00',
            company: '',
            isAdmin: true,
            registeredAt: new Date('2024-01-01').toISOString(),
            lastLogin: null,
            profileComplete: true
        };
        users.push(testAdmin);
        console.log('Тестовый администратор создан');
    }

    if (users.length > 0) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        console.log('Пользователи сохранены в localStorage:', users.length);
    }

    // Тестовые вакансии
    const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
    console.log('Текущие вакансии:', jobs.length);

    if (jobs.length === 0) {
        const testJobs = [
            {
                id: 1001,
                title: "Бариста в кофейню",
                location: "Центр",
                salary: "45 000 руб.",
                description: "Приготовление кофе, обслуживание гостей, работа с кассой. Обучение предоставляем.",
                employerEmail: "employer@example.com",
                employerName: "Кофейня 'Уютная'",
                employerPhone: "+7 (999) 987-65-43",
                contacts: "coffee@example.com",
                createdAt: new Date().toISOString(),
                isActive: true,
                applicants: []
            },
            {
                id: 1002,
                title: "Курьер на велосипеде",
                location: "Левобережный",
                salary: "60 000 руб.",
                description: "Доставка еды и товаров по району. График 5/2, велосипед предоставляем.",
                employerEmail: "delivery@example.com",
                employerName: "Служба доставки 'Быстрая'",
                employerPhone: "+7 (999) 123-45-67",
                contacts: "+7 (999) 123-45-67",
                createdAt: new Date().toISOString(),
                isActive: true,
                applicants: []
            }
        ];

        localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(testJobs));
        console.log('Тестовые вакансии созданы:', testJobs.length);
    }
}

// ========== СЛУЖЕБНЫЕ ФУНКЦИИ ==========
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

async function checkAuth(required = true, redirectTo = 'login.html') {
    const user = await getCurrentUser();

    if (required && !user) {
        showNotification('Для доступа к этой странице необходимо войти в систему', 'warning');
        setTimeout(() => {
            window.location.href = redirectTo;
        }, 1500);
        return false;
    }

    return !!user;
}

function getUserRole() {
    return currentUser ? currentUser.role : null;
}

function isEmployer() {
    return currentUser && currentUser.role === USER_ROLES.EMPLOYER;
}

function isJobSeeker() {
    return currentUser && currentUser.role === USER_ROLES.JOB_SEEKER;
}

// ========== ФУНКЦИИ ДЛЯ РЕДАКТИРОВАНИЯ ПРОФИЛЯ ==========
async function updateProfile(name, phone, company) {
    const user = await getCurrentUser();
    if (!user) return false;

    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex !== -1) {
        users[userIndex].name = name || users[userIndex].name;
        users[userIndex].phone = phone || users[userIndex].phone;
        users[userIndex].company = company || users[userIndex].company;
        users[userIndex].profileComplete = true;

        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        // Обновляем текущего пользователя
        user.name = users[userIndex].name;
        user.phone = users[userIndex].phone;
        user.company = users[userIndex].company;

        if (localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        } else {
            sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        }

        updateUserMenu();
        return true;
    }

    return false;
}

async function changeEmail(newEmail, password) {
    const user = await getCurrentUser();
    if (!user) return false;

    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex === -1) return false;

    // Проверяем пароль
    if (users[userIndex].password !== password) {
        return false;
    }

    // Проверяем, не занят ли email
    if (users.some(u => u.email === newEmail && u.id !== user.id)) {
        return false;
    }

    users[userIndex].email = newEmail;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Обновляем текущего пользователя
    user.email = newEmail;

    if (localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
        sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }

    updateUserMenu();
    return true;
}

async function changePassword(currentPassword, newPassword) {
    const user = await getCurrentUser();
    if (!user) return false;

    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    const userIndex = users.findIndex(u => u.id === user.id);

    if (userIndex === -1) return false;

    // Проверяем текущий пароль
    if (users[userIndex].password !== currentPassword) {
        return false;
    }

    users[userIndex].password = newPassword;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return true;
}

async function getUserApplications() {
    const user = await getCurrentUser();
    if (!user) {
        console.log('getUserApplications: пользователь не авторизован');
        return [];
    }

    console.log('getUserApplications: загрузка откликов для пользователя', user.email);

    try {
        const url = API_BASE + 'my-applications.php';
        console.log('getUserApplications: запрос к', url);
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
        });

        console.log('getUserApplications: статус ответа', response.status, response.statusText);

        if (response.ok) {
            const data = await response.json();
            console.log('getUserApplications: данные ответа', data);
            
            if (data.success) {
                console.log('getUserApplications: получено откликов', data.applications?.length || 0);
                return data.applications || [];
            } else {
                console.error('getUserApplications: ошибка от сервера', data.message);
            }
        } else {
            const errorText = await response.text();
            console.error('getUserApplications: ошибка HTTP', response.status, errorText);
        }
    } catch (error) {
        console.error('getUserApplications: ошибка загрузки откликов:', error);
    }

    // Fallback на localStorage если API недоступен
    console.log('getUserApplications: использование fallback на localStorage');
    const applications = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) || [];
    const filtered = applications.filter(app => app.applicantEmail === user.email);
    console.log('getUserApplications: найдено откликов в localStorage', filtered.length);
    return filtered;
}

async function deleteApplication(applicationId) {
    const user = await getCurrentUser();
    if (!user) {
        console.error('deleteApplication: пользователь не авторизован');
        return false;
    }

    console.log('deleteApplication: удаление отклика ID:', applicationId);

    try {
        const response = await fetch(API_BASE + 'applications.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                application_id: applicationId
            })
        });

        console.log('deleteApplication: статус ответа', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('deleteApplication: ошибка HTTP', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('deleteApplication: данные ответа', data);

        if (data.success) {
            // Обновляем статистику
            await updateApplicationStats();
            return true;
        } else {
            console.error('deleteApplication: ошибка от сервера', data.message);
            return false;
        }
    } catch (error) {
        console.error('deleteApplication: ошибка удаления отклика:', error);
        // Fallback на localStorage если API недоступен
        const applications = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) || [];
        const newApplications = applications.filter(app => app.id !== applicationId);
        localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(newApplications));
        return true;
    }
}

// ========== СИСТЕМА ВАКАНСИЙ ДЛЯ РАБОТОДАТЕЛЕЙ ==========
async function createJobVacancy(jobData) {
    const user = await getCurrentUser();
    if (!user || user.role !== USER_ROLES.EMPLOYER) {
        return { success: false, message: 'Только работодатели могут создавать вакансии' };
    }

    try {
        const response = await fetch(API_BASE + 'jobs.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(jobData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            return { success: true, job: data.job };
        } else {
            return { success: false, message: data.message || 'Ошибка при создании вакансии' };
        }
    } catch (error) {
        console.error('Ошибка при создании вакансии:', error);
        return { success: false, message: 'Ошибка подключения к серверу. Проверьте подключение к интернету.' };
    }
}

async function getEmployerJobs() {
    const user = await getCurrentUser();
    if (!user || user.role !== USER_ROLES.EMPLOYER) return [];

    try {
        const response = await fetch(API_BASE + 'my-jobs.php', {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                return data.jobs || [];
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки вакансий работодателя:', error);
    }

    // Fallback на localStorage если API недоступен
    const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
    return jobs.filter(job => job.employerEmail === user.email);
}

async function updateJob(jobId, jobData) {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: 'Не авторизован' };

    const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
    const jobIndex = jobs.findIndex(job => job.id === jobId);

    if (jobIndex === -1) {
        return { success: false, message: 'Вакансия не найдена' };
    }

    if (jobs[jobIndex].employerEmail !== user.email) {
        return { success: false, message: 'Нет прав на редактирование' };
    }

    // Обновляем только разрешенные поля
    const allowedFields = ['title', 'description', 'location', 'salary', 'requirements', 'benefits', 'schedule', 'isActive'];
    allowedFields.forEach(field => {
        if (jobData[field] !== undefined) {
            jobs[jobIndex][field] = jobData[field];
        }
    });

    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    return { success: true };
}
        //удаление вакансии
async function deleteJob(jobId) {
  console.log("Удаление вакансии ID:", jobId);

  const user = await getCurrentUser();
  if (!user) {
    showNotification("Для удаления необходимо войти в систему", "warning");
    return false;
  }

  if (!confirm("Вы уверены, что хотите удалить эту вакансию?")) {
    return false;
  }

  try {
    const response = await fetch(API_BASE + "jobs.php", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        job_id: jobId,
      }),
    });

    const data = await response.json();

    if (data.success) {
      showNotification("Вакансия удалена", "success");
      
      // Обновляем localStorage для совместимости
      const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
      const newJobs = jobs.filter(job => job.id != jobId);
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(newJobs));
      
      // Если на странице my-jobs.html - обновляем
      if (window.location.pathname.includes("my-jobs.html")) {
        setTimeout(() => location.reload(), 1000);
      }
      
      return true;
    } else {
      showNotification(data.message || "Ошибка удаления", "error");
      return false;
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    showNotification("Ошибка подключения к серверу", "error");
    return false;
  }
}

async function getJobApplicants(jobId) {
    const user = await getCurrentUser();
    if (!user || user.role !== USER_ROLES.EMPLOYER) return [];

    try {
        const response = await fetch(API_BASE + 'applications.php?job_id=' + jobId, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                return data.applications || [];
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки откликов:', error);
    }

    // Fallback на localStorage если API недоступен
    const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
    const job = jobs.find(j => j.id === jobId);

    if (!job || job.employerEmail !== user.email) return [];

    const applications = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) || [];
    return applications.filter(app => app.jobId == jobId);
}

async function updateApplicationStatus(applicationId, newStatus) {
    const applications = JSON.parse(localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) || [];
    const appIndex = applications.findIndex(app => app.id === applicationId);

    if (appIndex === -1) return false;

    // Проверяем, что пользователь - работодатель этой вакансии
    const user = await getCurrentUser();
    const jobs = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOBS)) || [];
    const job = jobs.find(j => j.id == applications[appIndex].jobId);

    if (!user || user.role !== USER_ROLES.EMPLOYER || !job || job.employerEmail !== user.email) {
        return false;
    }

    applications[appIndex].status = newStatus;
    applications[appIndex].updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(applications));
    return true;
}

// ========== ЭКСПОРТ ФУНКЦИЙ ==========
window.openModal = openModal;
window.logout = logout;
window.submitContactForm = submitContactForm;
window.checkAuth = checkAuth;
window.getUserRole = getUserRole;
window.isEmployer = isEmployer;
window.isJobSeeker = isJobSeeker;
window.loginUser = loginUser;
window.registerUser = registerUser;
window.getCurrentUser = getCurrentUser;
window.showNotification = showNotification;
window.formatDate = formatDate;

window.updateProfile = updateProfile;
window.changeEmail = changeEmail;
window.changePassword = changePassword;
window.getUserApplications = getUserApplications;
window.deleteApplication = deleteApplication;

window.createJobVacancy = createJobVacancy;
window.getEmployerJobs = getEmployerJobs;
window.updateJob = updateJob;
window.deleteJob = deleteJob;
window.getJobApplicants = getJobApplicants;
window.updateApplicationStatus = updateApplicationStatus;

console.log('Система Podrabotka инициализирована!');