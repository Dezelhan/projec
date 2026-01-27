const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = './database.db';

console.log('  ПРОСМОТР ПОЛЬЗОВАТЕЛЕЙ В БАЗЕ ДАННЫХ');

console.log('');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к базе данных:', err.message);
        console.log('');
        console.log('Убедитесь, что:');
        console.log('1. Сервер был запущен хотя бы один раз');
        console.log('2. Файл database.db существует в папке проекта');
        process.exit(1);
    }

    console.log('✓ Подключено к базе данных');
    console.log('');

    // Получаем всех пользователей
    db.all("SELECT id, email, name, role, phone, company, is_admin, registered_at, last_login FROM users ORDER BY id", [], (err, rows) => {
        if (err) {
            console.error('❌ Ошибка при получении данных:', err.message);
            db.close();
            process.exit(1);
        }

        if (rows.length === 0) {
            console.log('⚠️  В базе данных нет пользователей');
            console.log('');
            console.log('Запустите сервер и зарегистрируйте пользователя или');
            console.log('тестовые пользователи будут созданы автоматически');
        } else {
            console.log(`Найдено пользователей: ${rows.length}`);
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');

            rows.forEach((user, index) => {
                console.log(`Пользователь #${index + 1}`);
                console.log(`  ID: ${user.id}`);
                console.log(`  Email: ${user.email}`);
                console.log(`  Имя: ${user.name || '(не указано)'}`);
                console.log(`  Роль: ${user.role === 'employer' ? 'Работодатель' : 'Искатель работы'}`);
                console.log(`  Администратор: ${user.is_admin === 1 ? 'Да' : 'Нет'}`);
                console.log(`  Телефон: ${user.phone || '(не указан)'}`);
                console.log(`  Компания: ${user.company || '(не указана)'}`);
                console.log(`  Дата регистрации: ${user.registered_at || '(не указана)'}`);
                console.log(`  Последний вход: ${user.last_login || 'Никогда'}`);
                console.log('');
            });

            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            console.log('⚠️  ВАЖНО: Пароли хранятся в зашифрованном виде (bcrypt)');
            console.log('   Для безопасности они не отображаются');
        }

        db.close((err) => {
            if (err) {
                console.error('Ошибка закрытия БД:', err.message);
            }
            process.exit(0);
        });
    });
});
