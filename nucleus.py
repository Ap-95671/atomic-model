import pygame
import math

from constants import (
    RED,
    GRAY,
    PROTON_RADIUS,
    NEUTRON_RADIUS
)


class Nucleus:

    def __init__(self, center_x, center_y, protons, neutrons):

        self.center_x = center_x
        self.center_y = center_y

        self.protons = protons
        self.neutrons = neutrons

    def draw(self, screen):

        particles = []

        # Add protons
        for _ in range(self.protons):
            particles.append("proton")

        # Add neutrons
        for _ in range(self.neutrons):
            particles.append("neutron")

        total = len(particles)

        if total == 1:

            positions = [
                (self.center_x, self.center_y)
            ]

        else:

            positions = []

            nucleus_radius = 25

            for i in range(total):

                angle = (2 * math.pi / total) * i

                x = self.center_x + nucleus_radius * math.cos(angle)
                y = self.center_y + nucleus_radius * math.sin(angle)

                positions.append(
                    (int(x), int(y))
                )

        for particle, position in zip(particles, positions):

            if particle == "proton":

                pygame.draw.circle(
                    screen,
                    RED,
                    position,
                    PROTON_RADIUS
                )

            else:

                pygame.draw.circle(
                    screen,
                    GRAY,
                    position,
                    NEUTRON_RADIUS
                )