import argparse
import os
import re
import json
from collections import namedtuple

import dotenv
from PIL import Image, ImageDraw
from google import genai

Resolution = namedtuple("Resolution", ["width", "height"])
Coordinate = namedtuple("Coordinate", ["x", "y"])


def crop_image(image_path: str):
    img = Image.open(image_path)
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    resolution = Resolution(img.width, img.height)

    if resolution.width > resolution.height:
        crop_direction = "vertical"
    else:
        crop_direction = "horizontal"

    square_side_length = min(resolution.width, resolution.height)

    square_starting_points = [
        Coordinate(0, 0),
    ]
    crop_step = round(square_side_length * 0.5)

    if crop_direction == "vertical":
        x = crop_step
        while x + square_side_length <= resolution.width:
            square_starting_points.append(Coordinate(x, 0))
            x += crop_step

        final_x = resolution.width - square_side_length
        if final_x > square_starting_points[-1].x:
            square_starting_points.append(Coordinate(final_x, 0))

    else:
        y = crop_step
        while y + square_side_length <= resolution.height:
            square_starting_points.append(Coordinate(0, y))
            y += crop_step

        final_y = resolution.height - square_side_length
        if final_y > square_starting_points[-1].y:
            square_starting_points.append(Coordinate(0, final_y))

    for i, start_point in enumerate(square_starting_points):
        crop_box = (
            start_point.x,
            start_point.y,
            start_point.x + square_side_length,
            start_point.y + square_side_length,
        )

        cropped_img = img.crop(crop_box).resize((768, 768), Image.Resampling.LANCZOS)
        cropped_img.save(f"{base_name}_crop_{i}.png")

    print(f"Created {len(square_starting_points)} crops of size 768x768")


def detect_chrome(image: Image.Image) -> list[int]:
    client = genai.Client()

    # https://ai.google.dev/gemini-api/docs/image-understanding#object-detection
    prompt = "Detect the Chrome in the image. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000."
    model = "gemini-2.5-pro"

    response = client.models.generate_content_stream(
        model=model,
        contents=[image, prompt],
        config={
            "temperature": 0.0,
            "thinking_config": {"include_thoughts": True, "thinking_budget": 256},
        },
    )

    result = ""

    for chunk in response:
        for part in chunk.candidates[0].content.parts:
            print(part.text, end="")
            result += part.text

    print()

    json_match = re.search(r"```json\n(.*?)\n```", result, re.DOTALL)
    if json_match:
        json_text = json_match.group(1)
        data = json.loads(json_text)
        box_2d = data[0]["box_2d"]
        return box_2d
    else:
        raise ValueError("No JSON found in the response text")


def to_real_box(image: Image.Image, box: list[int]) -> list[int]:
    return [
        box[0] * image.height // 1000,
        box[1] * image.width // 1000,
        box[2] * image.height // 1000,
        box[3] * image.width // 1000,
    ]


def draw_box(
    screenshot: Image.Image, box: list[int], color: str = "white", width: int = 3
) -> Image.Image:
    ymin, xmin, ymax, xmax = box
    draw = ImageDraw.Draw(screenshot)
    draw.rectangle([xmin, ymin, xmax, ymax], outline=color, width=width)
    return screenshot


def crop_command(args):
    crop_image(args.image)


def detect_command(args):
    dotenv.load_dotenv()

    if args.output:
        output_file = args.output
    else:
        name, ext = args.image_file.rsplit(".", 1)
        output_file = f"{name}_anno.{ext}"

    image = Image.open(args.image_file)
    box_2d = detect_chrome(image)
    print("box_2d:", box_2d)
    real_box_2d = to_real_box(image, box_2d)
    print("Real box_2d:", real_box_2d)
    annotated_image = draw_box(image, real_box_2d)
    annotated_image.save(output_file)
    print(f"Annotated image saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Image processing tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    crop_parser = subparsers.add_parser(
        "crop", help="Crop image into overlapping squares"
    )
    crop_parser.add_argument("image", help="Input image file path")
    crop_parser.set_defaults(func=crop_command)

    detect_parser = subparsers.add_parser("detect", help="Detect Chrome in an image")
    detect_parser.add_argument("image_file", help="Path to the input image file")
    detect_parser.add_argument(
        "-o",
        "--output",
        help="Output path for annotated image (default: adds '_anno' to input filename)",
    )
    detect_parser.set_defaults(func=detect_command)

    args = parser.parse_args()

    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
