# api/management/commands/populate_initial_data.py

from django.core.management.base import BaseCommand
from api.models import ColorKey, TcgTheme
import uuid

class Command(BaseCommand):
    help = 'Populate the ColorKey and TcgTheme tables with initial data'

    def handle(self, *args, **options):
        # Initial Color Keys Data
        color_keys_data = [
            {'key_number': '1', 'color_name': 'TCG Red', 'R': 255, 'G': 0, 'B': 0, 'Hex': '#FF0000'},
            {'key_number': '2', 'color_name': 'TCG Blue', 'R': 0, 'G': 102, 'B': 255, 'Hex': '#0066FF'},
            {'key_number': '3', 'color_name': 'Carbon Gray Dark', 'R': 58, 'G': 56, 'B': 56, 'Hex': '#3A3838'},
            {'key_number': '4', 'color_name': 'TCG Red Dark', 'R': 191, 'G': 0, 'B': 0, 'Hex': '#BF0000'},
            {'key_number': '5', 'color_name': 'TCG Orange', 'R': 255, 'G': 171, 'B': 101, 'Hex': '#FFAB65'},
            {'key_number': '6', 'color_name': 'TCG Green', 'R': 179, 'G': 255, 'B': 196, 'Hex': '#B3FFC4'},
            {'key_number': '7', 'color_name': 'TCG Cyan', 'R': 57, 'G': 255, 'B': 255, 'Hex': '#39FFFF'},
            {'key_number': '8', 'color_name': 'TCG Purple', 'R': 92, 'G': 0, 'B': 184, 'Hex': '#5C00B8'},
            {'key_number': '9', 'color_name': 'Pink', 'R': 255, 'G': 71, 'B': 207, 'Hex': '#FF47CF'},
            {'key_number': '10', 'color_name': 'Forest Green', 'R': 76, 'G': 122, 'B': 29, 'Hex': '#4C7A1D'},
            {'key_number': '11', 'color_name': 'Astronaut Blue', 'R': 5, 'G': 74, 'B': 99, 'Hex': '#054A63'},
            {'key_number': '12', 'color_name': 'Brown', 'R': 148, 'G': 112, 'B': 60, 'Hex': '#94703C'},
            {'key_number': '13', 'color_name': 'Yellow', 'R': 255, 'G': 255, 'B': 153, 'Hex': '#FFFF99'},
            {'key_number': '14', 'color_name': 'Carbon Gray', 'R': 117, 'G': 113, 'B': 113, 'Hex': '#757171'},
            {'key_number': '15', 'color_name': 'Rust', 'R': 142, 'G': 47, 'B': 0, 'Hex': '#8E2F00'},
            {'key_number': '16', 'color_name': 'TCG Green Dark', 'R': 0, 'G': 191, 'B': 44, 'Hex': '#00BF2C'},
            {'key_number': '17', 'color_name': 'TCG Purple Dark', 'R': 92, 'G': 0, 'B': 184, 'Hex': '#5C00B8'},
            {'key_number': '18', 'color_name': 'TCG Blue Dark', 'R': 0, 'G': 51, 'B': 128, 'Hex': '#003380'},
            {'key_number': '19', 'color_name': 'TCG Cyan Dark', 'R': 0, 'G': 155, 'B': 155, 'Hex': '#009B9B'},
            {'key_number': '20', 'color_name': 'Rust Dark', 'R': 92, 'G': 31, 'B': 0, 'Hex': '#5C1F00'},
            {'key_number': '21', 'color_name': 'Carbon Gray Light', 'R': 174, 'G': 170, 'B': 170, 'Hex': '#AEAAAA'},
            {'key_number': '22', 'color_name': 'Gray Light', 'R': 242, 'G': 242, 'B': 242, 'Hex': '#F2F2F2'},
            {'key_number': '23', 'color_name': 'Black', 'R': 0, 'G': 0, 'B': 0, 'Hex': '#000000'},
            {'key_number': '24', 'color_name': 'White', 'R': 255, 'G': 255, 'B': 255, 'Hex': '#FFFFFF'},
            {'key_number': '25', 'color_name': 'TCG Orange Light', 'R': 255, 'G': 204, 'B': 162, 'Hex': '#FFCCA2'},
            {'key_number': '26', 'color_name': 'TCG Green Light', 'R': 204, 'G': 255, 'B': 216, 'Hex': '#CCFFD8'},
            {'key_number': '27', 'color_name': 'TCG Cyan Light', 'R': 174, 'G': 255, 'B': 255, 'Hex': '#AEFFFF'},
            {'key_number': '28', 'color_name': 'TCG Purple Light', 'R': 157, 'G': 62, 'B': 253, 'Hex': '#9D3EFD'},
            {'key_number': '29', 'color_name': 'Pink Light', 'R': 252, 'G': 178, 'B': 236, 'Hex': '#FCB2EC'},
            {'key_number': '30', 'color_name': 'Forest Green Light', 'R': 111, 'G': 179, 'B': 43, 'Hex': '#6FB32B'},
            {'key_number': '31', 'color_name': 'Astronaut Blue Light', 'R': 8, 'G': 124, 'B': 167, 'Hex': '#087CA7'},
            {'key_number': '32', 'color_name': 'Brown Light', 'R': 209, 'G': 182, 'B': 143, 'Hex': '#D1B68F'},
            {'key_number': '33', 'color_name': 'Yellow Light', 'R': 255, 'G': 255, 'B': 217, 'Hex': '#FFFFD9'},
        ]

        # Initial TCG Themes Data
        tcg_themes_data = [
            { 'theme_key': 'A', 'theme_name': 'CMA', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '1', 'excel_text': 'White', 'color_key_number': '1' },
            { 'theme_key': 'B', 'theme_name': 'PMA', 'fill': 'No', 'transparency': '-', 'border': 'Yes', 'weight': '3', 'excel_fill': '2', 'excel_text': 'White', 'color_key_number': '2' },
            { 'theme_key': 'C', 'theme_name': 'Subject MSA', 'fill': 'No', 'transparency': '-', 'border': 'Yes', 'weight': '3', 'excel_fill': '3', 'excel_text': 'White', 'color_key_number': '3' },
            { 'theme_key': 'D', 'theme_name': 'Micro-Market (Sub-CMA)', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '4', 'excel_text': 'White', 'color_key_number': '4' },
            { 'theme_key': 'E', 'theme_name': 'Submarket 1', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '25', 'excel_text': 'Black', 'color_key_number': '5' },
            { 'theme_key': 'F', 'theme_name': 'Submarket 2', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '26', 'excel_text': 'Black', 'color_key_number': '6' },
            { 'theme_key': 'G', 'theme_name': 'Submarket 3', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '27', 'excel_text': 'Black', 'color_key_number': '7' },
            { 'theme_key': 'H', 'theme_name': 'Submarket 4', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '28', 'excel_text': 'Black', 'color_key_number': '8' },
            { 'theme_key': 'I', 'theme_name': 'Submarket 5', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '29', 'excel_text': 'Black', 'color_key_number': '9' },
            { 'theme_key': 'J', 'theme_name': 'Submarket 6', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '30', 'excel_text': 'Black', 'color_key_number': '10' },
            { 'theme_key': 'K', 'theme_name': 'Submarket 7', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '31', 'excel_text': 'Black', 'color_key_number': '11' },
            { 'theme_key': 'L', 'theme_name': 'Submarket 8', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '32', 'excel_text': 'Black', 'color_key_number': '12' },
            { 'theme_key': 'M', 'theme_name': 'Submarket 9', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '33', 'excel_text': 'Black', 'color_key_number': '13' },
            { 'theme_key': 'N', 'theme_name': 'Submarket 10', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '14', 'excel_text': 'White', 'color_key_number': '14' },
            { 'theme_key': 'O', 'theme_name': 'Submarket 11', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '15', 'excel_text': 'White', 'color_key_number': '15' },
            { 'theme_key': 'P', 'theme_name': 'Submarket 12', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '16', 'excel_text': 'Black', 'color_key_number': '16' },
            { 'theme_key': 'Q', 'theme_name': 'Submarket 13', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '17', 'excel_text': 'White', 'color_key_number': '17' },
            { 'theme_key': 'R', 'theme_name': 'Submarket 14', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '18', 'excel_text': 'White', 'color_key_number': '18' },
            { 'theme_key': 'S', 'theme_name': 'Submarket 15', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '19', 'excel_text': 'White', 'color_key_number': '19' },
            { 'theme_key': 'T', 'theme_name': 'Submarket 16', 'fill': 'Yes', 'transparency': '65%', 'border': 'No', 'weight': '-', 'excel_fill': '20', 'excel_text': 'White', 'color_key_number': '20' },
            { 'theme_key': 'U', 'theme_name': 'MSA 1', 'fill': 'No', 'transparency': '-', 'border': 'Yes', 'weight': '2 or 3', 'excel_fill': '21', 'excel_text': 'White', 'color_key_number': '21' },
            { 'theme_key': 'V', 'theme_name': 'MSA 2', 'fill': 'No', 'transparency': '-', 'border': 'Yes', 'weight': '2 or 3', 'excel_fill': '22', 'excel_text': 'Black', 'color_key_number': '22' },
            { 'theme_key': 'W', 'theme_name': 'MSA 3', 'fill': 'No', 'transparency': '-', 'border': 'Yes', 'weight': '2 or 3', 'excel_fill': '23', 'excel_text': 'White', 'color_key_number': '23' },
            { 'theme_key': 'X', 'theme_name': 'MSA 4', 'fill': 'No', 'transparency': '-', 'border': 'Yes', 'weight': '2 or 3', 'excel_fill': '24', 'excel_text': 'Black', 'color_key_number': '24' },
        ]

        # Populate ColorKey
        self.stdout.write(self.style.NOTICE('Populating ColorKey table...'))
        for ck_data in color_keys_data:
            color_key, created = ColorKey.objects.get_or_create(
                key_number=ck_data['key_number'],
                defaults={
                    'color_name': ck_data['color_name'],
                    'R': ck_data['R'],
                    'G': ck_data['G'],
                    'B': ck_data['B'],
                    'Hex': ck_data['Hex'],
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created ColorKey {color_key.key_number} - {color_key.color_name}"))
            else:
                self.stdout.write(self.style.WARNING(f"ColorKey {color_key.key_number} already exists"))

        # Populate TcgTheme
        self.stdout.write(self.style.NOTICE('Populating TcgTheme table...'))
        for tt_data in tcg_themes_data:
            try:
                color_key = ColorKey.objects.get(key_number=tt_data['color_key_number'])
            except ColorKey.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"ColorKey with key_number {tt_data['color_key_number']} does not exist. Skipping TcgTheme {tt_data['theme_key']}"))
                continue

            tcg_theme, created = TcgTheme.objects.get_or_create(
                theme_key=tt_data['theme_key'],
                defaults={
                    'theme_name': tt_data['theme_name'],
                    'fill': tt_data['fill'],
                    'transparency': tt_data['transparency'],
                    'border': tt_data['border'],
                    'weight': tt_data['weight'],
                    'excel_fill': tt_data['excel_fill'],
                    'excel_text': tt_data['excel_text'],
                    'color_key': color_key,
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created TcgTheme {tcg_theme.theme_key} - {tcg_theme.theme_name}"))
            else:
                self.stdout.write(self.style.WARNING(f"TcgTheme {tcg_theme.theme_key} already exists"))
