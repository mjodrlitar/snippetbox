-- Тестовые данные, чтобы приложение не выглядело пустым.

INSERT INTO languages (code, name) VALUES
    ('text',   'Plain Text'),
    ('c',      'C'),
    ('cpp',    'C++'),
    ('go',     'Go'),
    ('python', 'Python'),
    ('js',     'JavaScript'),
    ('rust',   'Rust'),
    ('sh',     'Shell');

-- Пароль у всех тестовых пользователей: "password" (bcrypt, cost 12).
INSERT INTO users (username, email, password_hash, created_at) VALUES
    ('n3cr0l0rd', 'necro@example.com', '$2a$12$o.gmbRwrC7dHtJiA8iiP5OpprAVPKpOGCEDn.9H15cq66P1dvL/ue', now() - interval '30 days'),
    ('alice',     'alice@example.com', '$2a$12$o.gmbRwrC7dHtJiA8iiP5OpprAVPKpOGCEDn.9H15cq66P1dvL/ue', now() - interval '20 days'),
    ('bob',       'bob@example.com',   '$2a$12$o.gmbRwrC7dHtJiA8iiP5OpprAVPKpOGCEDn.9H15cq66P1dvL/ue', now() - interval '10 days');

INSERT INTO snippets (title, content, language, visibility, user_id, created_at, expires_at) VALUES
(
    'hello.c',
    E'#include <stdio.h>\n\nint main(void)\n{\n    printf("Hello World!");\n    return 0;\n}',
    'c', 'public', 1, now() - interval '2 minutes', NULL
),
(
    'paste.txt',
    E'Meeting notes:\n- move frontend to React (done)\n- dockerize app (done)\n- connect PostgreSQL\n- add auth',
    'text', 'public', NULL, now() - interval '35 minutes', now() + interval '1 day'
),
(
    'code.c',
    E'#include <stdlib.h>\n\n/* naive linked list */\nstruct node {\n    int value;\n    struct node *next;\n};\n\nstruct node *push(struct node *head, int value)\n{\n    struct node *n = malloc(sizeof *n);\n    n->value = value;\n    n->next = head;\n    return n;\n}',
    'c', 'public', 2, now() - interval '2 hours', NULL
),
(
    'log.txt',
    E'2024-12-07 12:33:01 INFO  Starting a HTTP server at 127.0.0.1:1223\n2024-12-07 12:33:05 INFO  GET / 200 1.2ms\n2024-12-07 12:34:10 WARN  GET /view?id=abc 400 0.3ms',
    'text', 'public', NULL, now() - interval '1 day', now() + interval '6 days'
),
(
    'my project.go',
    E'package main\n\nimport "fmt"\n\nfunc main() {\n\tch := make(chan int)\n\tgo func() { ch <- 42 }()\n\tfmt.Println(<-ch)\n}',
    'go', 'public', 1, now() - interval '2 days', NULL
),
(
    'fib.py',
    E'def fib(n: int) -> int:\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint([fib(i) for i in range(10)])',
    'python', 'public', 3, now() - interval '3 days', NULL
),
(
    'arch_install_instruction.txt',
    E'1. loadkeys us\n2. timedatectl set-ntp true\n3. cfdisk /dev/sda\n4. mkfs.ext4 /dev/sda2\n5. mount /dev/sda2 /mnt\n6. pacstrap /mnt base linux linux-firmware\n7. genfstab -U /mnt >> /mnt/etc/fstab\n8. arch-chroot /mnt',
    'sh', 'public', 2, now() - interval '4 days', NULL
),
(
    'temp.cpp',
    E'#include <iostream>\n#include <vector>\n\nint main()\n{\n    std::vector<int> v{3, 1, 2};\n    for (int x : v) std::cout << x << " ";\n    return 0;\n}',
    'cpp', 'public', NULL, now() - interval '5 days', NULL
),
(
    'debounce.js',
    E'export function debounce(fn, ms) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}',
    'js', 'public', 3, now() - interval '6 days', NULL
),
(
    'main.rs',
    E'fn main() {\n    let v: Vec<u32> = (1..=5).map(|x| x * x).collect();\n    println!("{:?}", v);\n}',
    'rust', 'public', 1, now() - interval '7 days', NULL
),
-- Не видны в ленте: unlisted (доступен только по ссылке) и private.
(
    'secret-config.sh',
    E'export DB_PASSWORD=change-me',
    'sh', 'private', 1, now() - interval '1 hour', NULL
),
(
    'shared-link-only.txt',
    E'This snippet is unlisted: it is reachable by id but not shown in the feed.',
    'text', 'unlisted', 2, now() - interval '3 hours', NULL
),
-- Уже истёкший сниппет: в базе есть, но API его не отдаёт.
(
    'expired.txt',
    E'You should not see this.',
    'text', 'public', NULL, now() - interval '2 days', now() - interval '1 day'
);
