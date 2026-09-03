import math
import pygame

from constants import BLUE, ELECTRON_RADIUS


class Electron:

    def __init__(self, center_x, center_y, radius, angle, speed):

        self.center_x = center_x
        self.center_y = center_y

        self.radius = radius

        self.angle = angle
        self.speed = speed

    def update(self):

        self.angle += self.speed

    def get_position(self):

        x = self.center_x + self.radius * math.cos(self.angle)
        y = self.center_y + self.radius * math.sin(self.angle)

        return int(x), int(y)

    def draw(self, screen):

        x, y = self.get_position()

        pygame.draw.circle(
            screen,
            BLUE,
            (x, y),
            ELECTRON_RADIUS
        )