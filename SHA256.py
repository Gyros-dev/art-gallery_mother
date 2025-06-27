import pandas as pd
import hashlib


def encrypt_phone_to_sha256(phone):
    # Преобразуем номер в строку, удаляем пробелы и лишние символы
    phone_str = str(phone).strip()
    # Создаем SHA256 хеш
    sha256_hash = hashlib.sha256(phone_str.encode()).hexdigest()
    return sha256_hash


def process_xlsx_to_sha256(input_file, output_file):
    # Читаем XLSX файл, предполагая, что номера телефонов в первом столбце
    df = pd.read_excel(input_file, header=None)

    # Открываем выходной файл для записи
    with open(output_file, 'w') as f:
        for phone in df.iloc[:, 0]:  # Берем первый столбец
            sha256_hash = encrypt_phone_to_sha256(phone)
            f.write(sha256_hash + '\n')


# Укажите пути к файлам
input_xlsx = 'zivert 12-07-2025 phone.xlsx'  # Замените на ваш входной файл
output_txt = 'SHA256_zivert 12-07-2025 phone.txt'  # Имя выходного файла

# Обрабатываем файл
process_xlsx_to_sha256(input_xlsx, output_txt)

print(f"Файл успешно обработан. Результат сохранен в {output_txt}")