import math
import pygame

from nucleus import Nucleus
from electron import Electron

from constants import (
    CENTER_X,
    CENTER_Y,
    SHELL_RADII
)


class Atom:

    def __init__(self, element_data):

        self.name = element_data["name"]
        self.symbol = element_data["symbol"]

        self.atomic_number = element_data["atomic_number"]

        self.protons = element_data["protons"]
        self.neutrons = element_data["neutrons"]
        self.electron_count = element_data["electrons"]

        self.electron_configuration = element_data[
            "electron_configuration"
        ]

        self.nucleus = Nucleus(
            CENTER_X,
            CENTER_Y,
            self.protons,
            self.neutrons
        )

        self.electrons = []

        self.create_electrons()

    def calculate_shells(self):

        remaining = self.electron_count

        shell_capacities = [
            2,
            8,
            18,
            32
        ]

        shells = []

        for capacity in shell_capacities:

            if remaining <= 0:
                break

            electrons_in_shell = min(
                remaining,
                capacity
            )

            shells.append(electrons_in_shell)

            remaining -= electrons_in_shell

        return shells

    def create_electrons(self):

        shells = self.calculate_shells()

        for shell_index, electron_number in enumerate(shells):

            radius = SHELL_RADII[shell_index]

            for i in range(electron_number):

                angle = (
                    2 *
                    math.pi *
                    i /
                    electron_number
                )

                speed = 0.01 + shell_index * 0.003

                electron = Electron(
                    CENTER_X,
                    CENTER_Y,
                    radius,
                    angle,
                    speed
                )

                self.electrons.append(electron)

    def update(self):

        for electron in self.electrons:
            electron.update()

    def draw_shells(self, screen):

        shells = self.calculate_shells()

        for i in range(len(shells)):

            pygame.draw.circle(
                screen,
                (70, 70, 80),
                (CENTER_X, CENTER_Y),
                SHELL_RADII[i],
                2
            )

    def draw(self, screen):

        self.draw_shells(screen)

        self.nucleus.draw(screen)

        for electron in self.electrons:
            electron.draw(screen)