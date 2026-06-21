from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
from werkzeug.utils import secure_filename
import os
import io
import uuid
import json
import time
import threading
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'
FONTS_FOLDER = 'uploads/fonts'
TASKS_FOLDER = 'tasks'

for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, FONTS_FOLDER, TASKS_FOLDER]:
    os.makedirs(folder, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024

fonts_db = {}
tasks_db = {}

tasks_lock = threading.Lock()


def load_fonts_db():
    db_path = os.path.join(FONTS_FOLDER, 'fonts.json')
    if os.path.exists(db_path):
        try:
            with open(db_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {}
    return {}


def save_fonts_db():
    db_path = os.path.join(FONTS_FOLDER, 'fonts.json')
    with open(db_path, 'w', encoding='utf-8') as f:
        json.dump(fonts_db, f, ensure_ascii=False, indent=2)


fonts_db = load_fonts_db()


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def seeded_random(seed):
    import math
    x = math.sin(seed * 9999) * 10000
    return x - math.floor(x)


def add_paper_texture(img, paper_color, seed):
    import random
    random.seed(seed)
    width, height = img.size
    pixels = img.load()
    paper_rgb = hex_to_rgb(paper_color)
    
    for i in range(0, width, 2):
        for j in range(0, height, 2):
            if random.random() < 0.3:
                noise = random.randint(-10, 10)
                r, g, b, a = pixels[i, j]
                pixels[i, j] = (
                    max(0, min(255, r + noise)),
                    max(0, min(255, g + noise)),
                    max(0, min(255, b + noise)),
                    a
                )
    
    return img


def render_text_to_image(text, options, font_path=None):
    import math
    import random
    
    page_width = options.get('pageWidth', 800)
    page_height = options.get('pageHeight', 1150)
    padding = options.get('padding', 60)
    font_size = options.get('fontSize', 32)
    char_spacing = options.get('charSpacing', 2)
    line_height_ratio = options.get('lineHeight', 1.8)
    slant_angle = options.get('slantAngle', 0)
    ink_density = options.get('inkDensity', 80)
    random_offset = options.get('randomOffset', 3)
    stroke_noise = options.get('strokeNoise', 30)
    paper_color = options.get('paperColor', '#faf8f0')
    ink_color = options.get('inkColor', '#2c2c2c')
    weight = options.get('weight', 'normal')
    seed = options.get('seed', time.time())
    
    random.seed(seed)
    
    content_width = page_width - padding * 2
    content_height = page_height - padding * 2
    line_height = int(font_size * line_height_ratio)
    
    if font_path and os.path.exists(font_path):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception as e:
            print(f"字体加载失败: {e}")
            font = ImageFont.load_default()
    else:
        font = ImageFont.load_default()
    
    paragraphs = text.split('\n')
    lines = []
    
    for paragraph in paragraphs:
        if not paragraph:
            lines.append('')
            continue
        
        current_line = ''
        current_width = 0
        
        for char in paragraph:
            try:
                bbox = font.getbbox(char)
                char_width = bbox[2] - bbox[0] + char_spacing
            except:
                char_width = font_size * 0.6 + char_spacing
            
            if current_width + char_width > content_width and current_line:
                lines.append(current_line)
                current_line = char
                current_width = char_width
            else:
                current_line += char
                current_width += char_width
        
        if current_line:
            lines.append(current_line)
    
    lines_per_page = max(1, content_height // line_height)
    pages = [lines[i:i + lines_per_page] for i in range(0, len(lines), lines_per_page)]
    
    if not pages:
        pages = [[]]
    
    result_pages = []
    ink_rgb = hex_to_rgb(ink_color)
    paper_rgb = hex_to_rgb(paper_color)
    
    for page_idx, page_lines in enumerate(pages):
        img = Image.new('RGBA', (page_width, page_height), (*paper_rgb, 255))
        
        img = add_paper_texture(img, paper_color, seed + page_idx)
        
        draw = ImageDraw.Draw(img)
        
        y = padding
        char_index = 0
        
        for line_idx, line in enumerate(page_lines):
            x = padding
            
            for char_idx, char in enumerate(line):
                offset_x = random.uniform(-random_offset, random_offset)
                offset_y = random.uniform(-random_offset, random_offset)
                rotation = random.uniform(-2, 2)
                
                char_x = x + offset_x
                char_y = y + offset_y
                
                alpha = int(255 * (0.5 + (ink_density / 100) * 0.5))
                
                for layer in range(3):
                    layer_alpha = int(alpha * (0.6 + layer * 0.2))
                    layer_offset_x = random.uniform(-1, 1)
                    layer_offset_y = random.uniform(-1, 1)
                    
                    draw.text(
                        (char_x + layer_offset_x, char_y + layer_offset_y),
                        char,
                        font=font,
                        fill=(*ink_rgb, layer_alpha)
                    )
                
                try:
                    bbox = font.getbbox(char)
                    char_width = bbox[2] - bbox[0]
                except:
                    char_width = font_size * 0.6
                
                x += char_width + char_spacing
                char_index += 1
            
            y += line_height
        
        result_pages.append(img)
    
    return result_pages


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)


@app.route('/api/fonts', methods=['GET', 'HEAD'])
def list_fonts():
    fonts_list = [{
        'id': font_id,
        'name': font_info['name'],
        'fontFamily': font_info['fontFamily'],
        'path': font_info['path'],
        'size': font_info['size'],
        'uploadTime': font_info.get('uploadTime', '')
    } for font_id, font_info in fonts_db.items()]
    
    return jsonify({
        'success': True,
        'fonts': fonts_list
    })


@app.route('/api/fonts/<font_id>', methods=['DELETE'])
def delete_font(font_id):
    if font_id not in fonts_db:
        return jsonify({'success': False, 'error': '字体不存在'}), 404
    
    font_info = fonts_db[font_id]
    font_path = font_info['path']
    
    try:
        if os.path.exists(font_path):
            os.remove(font_path)
    except Exception as e:
        print(f"删除字体文件失败: {e}")
    
    del fonts_db[font_id]
    save_fonts_db()
    
    return jsonify({'success': True, 'message': '字体已删除'})


@app.route('/api/upload-font', methods=['POST'])
def upload_font():
    try:
        if 'font' not in request.files:
            return jsonify({'success': False, 'error': 'No font file provided'}), 400
        
        font_file = request.files['font']
        if font_file.filename == '':
            return jsonify({'success': False, 'error': 'No font file selected'}), 400
        
        allowed_extensions = {'.ttf', '.otf', '.woff', '.woff2'}
        filename = font_file.filename.lower()
        if not any(filename.endswith(ext) for ext in allowed_extensions):
            return jsonify({
                'success': False,
                'error': 'Only TTF, OTF, WOFF and WOFF2 files are supported'
            }), 400
        
        font_id = str(uuid.uuid4())
        safe_filename = secure_filename(font_file.filename)
        file_ext = os.path.splitext(safe_filename)[1]
        saved_filename = f"{font_id}{file_ext}"
        filepath = os.path.join(FONTS_FOLDER, saved_filename)
        
        font_file.save(filepath)
        
        font_size = os.path.getsize(filepath)
        
        font_family = f"Font_{font_id[:8]}"
        
        font_info = {
            'id': font_id,
            'name': font_file.filename,
            'fontFamily': font_family,
            'path': f"/uploads/fonts/{saved_filename}",
            'size': font_size,
            'uploadTime': datetime.now().isoformat()
        }
        
        fonts_db[font_id] = font_info
        save_fonts_db()
        
        return jsonify({
            'success': True,
            'fontId': font_id,
            'fontFamily': font_family,
            'fontPath': font_info['path'],
            'fontName': font_file.filename
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/uploads/fonts/<filename>')
def serve_font(filename):
    return send_from_directory(FONTS_FOLDER, filename)


@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        data = request.json
        text = data.get('text', '')
        options = data.get('options', {})
        font_id = options.get('fontId')
        
        font_path = None
        if font_id and font_id in fonts_db:
            font_path = fonts_db[font_id]['path'].replace('/uploads/fonts/', '')
            font_path = os.path.join(FONTS_FOLDER, font_path)
        
        pages = render_text_to_image(text, options, font_path)
        
        result = []
        for i, page_img in enumerate(pages):
            buffer = io.BytesIO()
            page_img.save(buffer, format='PNG')
            buffer.seek(0)
            import base64
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            result.append({
                'page': i + 1,
                'image': f'data:image/png;base64,{img_base64}'
            })
        
        return jsonify({
            'success': True,
            'pageCount': len(pages),
            'pages': result
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/generate-async', methods=['POST'])
def generate_async():
    try:
        data = request.json
        task_id = str(uuid.uuid4())
        
        task = {
            'id': task_id,
            'status': 'pending',
            'createdAt': datetime.now().isoformat(),
            'data': data
        }
        
        with tasks_lock:
            tasks_db[task_id] = task
        
        process_task(task_id)
        
        return jsonify({
            'success': True,
            'taskId': task_id,
            'status': 'pending'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def process_task(task_id):
    def worker():
        try:
            with tasks_lock:
                task = tasks_db.get(task_id)
                if not task:
                    return
                
                task['status'] = 'processing'
                task['startedAt'] = datetime.now().isoformat()
            
            data = task['data']
            text = data.get('text', '')
            options = data.get('options', {})
            font_id = options.get('fontId')
            
            font_path = None
            if font_id and font_id in fonts_db:
                font_path = fonts_db[font_id]['path'].replace('/uploads/fonts/', '')
                font_path = os.path.join(FONTS_FOLDER, font_path)
            
            pages = render_text_to_image(text, options, font_path)
            
            output_files = []
            for i, page_img in enumerate(pages):
                output_filename = f"{task_id}_page_{i+1}.png"
                output_path = os.path.join(OUTPUT_FOLDER, output_filename)
                page_img.save(output_path, 'PNG')
                output_files.append({
                    'page': i + 1,
                    'url': f"/output/{output_filename}"
                })
            
            with tasks_lock:
                task['status'] = 'completed'
                task['completedAt'] = datetime.now().isoformat()
                task['result'] = {
                    'pageCount': len(pages),
                    'files': output_files
                }
        
        except Exception as e:
            with tasks_lock:
                task = tasks_db.get(task_id)
                if task:
                    task['status'] = 'failed'
                    task['error'] = str(e)
    
    thread = threading.Thread(target=worker)
    thread.daemon = True
    thread.start()


@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task_status(task_id):
    with tasks_lock:
        task = tasks_db.get(task_id)
    
    if not task:
        return jsonify({'success': False, 'error': 'Task not found'}), 404
    
    return jsonify({
        'success': True,
        'taskId': task_id,
        'status': task['status'],
        'createdAt': task.get('createdAt'),
        'startedAt': task.get('startedAt'),
        'completedAt': task.get('completedAt'),
        'result': task.get('result'),
        'error': task.get('error')
    })


@app.route('/output/<filename>')
def serve_output(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)


@app.route('/api/export-long-image', methods=['POST'])
def export_long_image():
    try:
        data = request.json
        text = data.get('text', '')
        options = data.get('options', {})
        font_id = options.get('fontId')
        
        font_path = None
        if font_id and font_id in fonts_db:
            font_path = fonts_db[font_id]['path'].replace('/uploads/fonts/', '')
            font_path = os.path.join(FONTS_FOLDER, font_path)
        
        pages = render_text_to_image(text, options, font_path)
        
        total_height = sum(img.height for img in pages)
        width = pages[0].width if pages else 800
        
        long_img = Image.new('RGBA', (width, total_height), (*hex_to_rgb(options.get('paperColor', '#faf8f0')), 255))
        
        y_offset = 0
        for page_img in pages:
            long_img.paste(page_img, (0, y_offset))
            y_offset += page_img.height
        
        buffer = io.BytesIO()
        long_img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name='handwriting_long.png'
        )
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/export-pages', methods=['POST'])
def export_pages():
    try:
        data = request.json
        text = data.get('text', '')
        options = data.get('options', {})
        page_index = data.get('page', 0)
        font_id = options.get('fontId')
        
        font_path = None
        if font_id and font_id in fonts_db:
            font_path = fonts_db[font_id]['path'].replace('/uploads/fonts/', '')
            font_path = os.path.join(FONTS_FOLDER, font_path)
        
        pages = render_text_to_image(text, options, font_path)
        
        if page_index < 0 or page_index >= len(pages):
            page_index = 0
        
        buffer = io.BytesIO()
        pages[page_index].save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name=f'handwriting_page_{page_index + 1}.png'
        )
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/cleanup', methods=['POST'])
def cleanup_old_files():
    try:
        import glob
        
        now = time.time()
        cutoff = now - 24 * 60 * 60
        
        count = 0
        for filepath in glob.glob(os.path.join(OUTPUT_FOLDER, '*.png')):
            if os.path.getmtime(filepath) < cutoff:
                os.remove(filepath)
                count += 1
        
        with tasks_lock:
            old_tasks = [tid for tid, task in tasks_db.items() 
                          if task.get('completedAt') and 
                          (now - datetime.fromisoformat(task['completedAt']).timestamp()) > cutoff]
            for tid in old_tasks:
                del tasks_db[tid]
        
        return jsonify({
            'success': True,
            'deletedFiles': count,
            'deletedTasks': len(old_tasks)
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'status': 'ok',
        'fontsCount': len(fonts_db),
        'tasksCount': len(tasks_db)
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0', threaded=True)
