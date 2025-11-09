#!/usr/bin/env python3
"""
Test suite for ESC-POS to python-escpos verification

Tests various ESC-POS command sequences to ensure proper conversion
and verification.
"""

import unittest
from escpos_verifier import EscPosVerifier, ParsedCommand


class TestEscPosVerifier(unittest.TestCase):
    """Test cases for ESC-POS verification"""

    def setUp(self):
        """Set up test fixtures"""
        self.verifier = EscPosVerifier()

    def test_simple_text(self):
        """Test basic text output"""
        escpos = b"Hello World"
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0].name, "text")
        self.assertEqual(commands[0].params["text"], "Hello World")

    def test_initialize(self):
        """Test printer initialization"""
        escpos = bytes([0x1B, 0x40])  # ESC @
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0].name, "initialize")
        self.assertEqual(commands[0].python_call, "p.hw('init')")

    def test_bold_on_off(self):
        """Test bold text formatting"""
        escpos = bytes([
            0x1B, 0x45, 0x01,  # Bold on
            ord('B'), ord('o'), ord('l'), ord('d'),
            0x1B, 0x45, 0x00,  # Bold off
        ])
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(commands[0].name, "bold")
        self.assertTrue(commands[0].params["enabled"])
        self.assertEqual(commands[1].name, "text")
        self.assertEqual(commands[2].name, "bold")
        self.assertFalse(commands[2].params["enabled"])

    def test_underline(self):
        """Test underline formatting"""
        escpos = bytes([
            0x1B, 0x2D, 0x01,  # Underline on (1-dot)
            ord('U'), ord('n'), ord('d'), ord('e'), ord('r'),
            0x1B, 0x2D, 0x00,  # Underline off
        ])
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(commands[0].name, "underline")
        self.assertEqual(commands[0].params["mode"], 1)
        self.assertEqual(commands[2].name, "underline")
        self.assertEqual(commands[2].params["mode"], 0)

    def test_alignment(self):
        """Test text alignment"""
        # Left
        escpos_left = bytes([0x1B, 0x61, 0x00])
        cmd = self.verifier.parse_escpos(escpos_left)[0]
        self.assertEqual(cmd.params["align"], "left")

        # Center
        escpos_center = bytes([0x1B, 0x61, 0x01])
        cmd = self.verifier.parse_escpos(escpos_center)[0]
        self.assertEqual(cmd.params["align"], "center")

        # Right
        escpos_right = bytes([0x1B, 0x61, 0x02])
        cmd = self.verifier.parse_escpos(escpos_right)[0]
        self.assertEqual(cmd.params["align"], "right")

    def test_print_mode_double_size(self):
        """Test print mode with double width and height"""
        # ESC ! with bit 4 (double height) and bit 5 (double width) set
        escpos = bytes([0x1B, 0x21, 0x30])  # 0x30 = 0b00110000
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(commands[0].name, "print_mode")
        self.assertEqual(commands[0].params["size"], "2x")
        self.assertFalse(commands[0].params["bold"])  # Bit 3 not set in 0x30

        # Test with bold as well
        escpos_bold = bytes([0x1B, 0x21, 0x38])  # 0x38 = 0b00111000 (bold + double height)
        commands_bold = self.verifier.parse_escpos(escpos_bold)
        self.assertTrue(commands_bold[0].params["bold"])

    def test_paper_cut(self):
        """Test paper cut commands"""
        # Full cut
        escpos_full = bytes([0x1D, 0x56, 0x00])
        cmd = self.verifier.parse_escpos(escpos_full)[0]
        self.assertEqual(cmd.name, "cut")
        self.assertEqual(cmd.params["mode"], "FULL")

        # Partial cut
        escpos_partial = bytes([0x1D, 0x56, 0x01])
        cmd = self.verifier.parse_escpos(escpos_partial)[0]
        self.assertEqual(cmd.name, "cut")
        self.assertEqual(cmd.params["mode"], "PART")

    def test_line_feed(self):
        """Test line feed command"""
        escpos = bytes([0x0A])
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0].name, "line_feed")

    def test_character_size(self):
        """Test GS ! character size command"""
        # Width=2, Height=3 -> value = (2-1) | ((3-1) << 4) = 1 | 32 = 33
        escpos = bytes([0x1D, 0x21, 0x21])
        commands = self.verifier.parse_escpos(escpos)

        self.assertEqual(commands[0].name, "size")
        self.assertEqual(commands[0].params["width"], 2)
        self.assertEqual(commands[0].params["height"], 3)

    def test_complex_receipt(self):
        """Test a complex receipt with multiple formatting commands"""
        escpos = bytes([
            0x1B, 0x40,              # Initialize
            0x1B, 0x61, 0x01,        # Center align
            0x1B, 0x45, 0x01,        # Bold on
            ord('R'), ord('E'), ord('C'), ord('E'), ord('I'), ord('P'), ord('T'),
            0x1B, 0x45, 0x00,        # Bold off
            0x0A, 0x0A,              # Double line feed
            0x1B, 0x61, 0x00,        # Left align
            ord('I'), ord('t'), ord('e'), ord('m'), ord(' '), ord('1'),
            0x0A,
            0x1B, 0x61, 0x02,        # Right align
            ord('$'), ord('1'), ord('0'), ord('.'), ord('0'), ord('0'),
            0x0A,
            0x1D, 0x56, 0x00,        # Full cut
        ])

        commands = self.verifier.parse_escpos(escpos)

        # Check structure
        command_types = [cmd.name for cmd in commands]
        self.assertIn("initialize", command_types)
        self.assertIn("bold", command_types)
        self.assertIn("align", command_types)
        self.assertIn("cut", command_types)

        # Verify conversion
        python_code = self.verifier.generate_python_code(commands)
        self.assertIn("p.hw('init')", python_code)
        self.assertIn("p.set(bold=True)", python_code)
        self.assertIn("p.set(align='center')", python_code)
        self.assertIn("p.cut(mode='FULL')", python_code)

    def test_round_trip_verification(self):
        """Test that ESC-POS -> python-escpos -> ESC-POS works"""
        original = bytes([
            0x1B, 0x40,              # Initialize
            0x1B, 0x61, 0x01,        # Center
            ord('T'), ord('E'), ord('S'), ord('T'),
            0x0A,
            0x1D, 0x56, 0x00,        # Cut
        ])

        # Convert to python-escpos
        python_code = self.verifier.bytes_to_python_escpos(original)

        # Verify
        success, message = self.verifier.verify(original, python_code)
        self.assertTrue(success, f"Verification failed: {message}")

    def test_special_characters_escaping(self):
        """Test that special characters are properly escaped"""
        escpos = bytes([
            ord("'"), ord('"'), ord('\\')
        ])

        commands = self.verifier.parse_escpos(escpos)
        python_code = self.verifier.generate_python_code(commands)

        # Should have escaped characters in the generated code
        self.assertIn("\\'", python_code)  # Escaped single quote
        self.assertIn("\\\\", python_code)  # Escaped backslash

    def test_mixed_text_and_formatting(self):
        """Test alternating text and formatting commands"""
        escpos = bytes([
            ord('N'), ord('o'), ord('r'), ord('m'), ord('a'), ord('l'),
            0x1B, 0x45, 0x01,        # Bold on
            ord('B'), ord('o'), ord('l'), ord('d'),
            0x1B, 0x45, 0x00,        # Bold off
            ord('N'), ord('o'), ord('r'), ord('m'), ord('a'), ord('l'),
        ])

        commands = self.verifier.parse_escpos(escpos)

        # Should have 5 commands: text, bold on, text, bold off, text
        self.assertEqual(len(commands), 5)
        self.assertEqual(commands[0].params["text"], "Normal")
        self.assertEqual(commands[2].params["text"], "Bold")
        self.assertEqual(commands[4].params["text"], "Normal")

    def test_semantic_equivalence(self):
        """Test that semantic equivalence checking works"""
        # Create two similar command lists
        cmd1 = [
            ParsedCommand("text", b"Hello", "p.text('Hello')", {"text": "Hello"}),
            ParsedCommand("bold", b"\x1b\x45\x01", "p.set(bold=True)", {"enabled": True}),
        ]

        cmd2 = [
            ParsedCommand("text", b"Hello", "p.text('Hello')", {"text": "Hello"}),
            ParsedCommand("unknown", b"\x1b\x74\x00", "", {}),  # Python-escpos internal
            ParsedCommand("bold", b"\x1b\x45\x01", "p.set(bold=True)", {"enabled": True}),
        ]

        # Should be semantically equivalent (unknown command ignored)
        self.assertTrue(self.verifier._semantically_equivalent(cmd1, cmd2))

    def test_empty_input(self):
        """Test handling of empty input"""
        escpos = b""
        commands = self.verifier.parse_escpos(escpos)
        self.assertEqual(len(commands), 0)

    def test_invalid_escape_sequence(self):
        """Test handling of truncated escape sequence"""
        # ESC without following byte
        escpos = bytes([0x1B])
        commands = self.verifier.parse_escpos(escpos)
        # Should not crash, just skip the incomplete command
        self.assertEqual(len(commands), 0)


class TestCodeGeneration(unittest.TestCase):
    """Test python-escpos code generation"""

    def setUp(self):
        self.verifier = EscPosVerifier()

    def test_generated_code_structure(self):
        """Test that generated code has proper structure"""
        escpos = b"Test"
        code = self.verifier.bytes_to_python_escpos(escpos)

        # Check for required imports
        self.assertIn("from escpos.printer import Dummy", code)

        # Check for printer initialization
        self.assertIn("p = Dummy()", code)

        # Check for output capture
        self.assertIn("escpos_output = p.output", code)

    def test_generated_code_is_executable(self):
        """Test that generated code can be executed"""
        escpos = bytes([0x1B, 0x40, ord('T'), ord('e'), ord('s'), ord('t')])
        code = self.verifier.bytes_to_python_escpos(escpos)

        # Should not raise an exception
        try:
            result = self.verifier.execute_python_code(code)
            self.assertIsInstance(result, bytes)
            self.assertGreater(len(result), 0)
        except Exception as e:
            self.fail(f"Generated code failed to execute: {e}")


def run_tests():
    """Run all tests and display results"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test cases
    suite.addTests(loader.loadTestsFromTestCase(TestEscPosVerifier))
    suite.addTests(loader.loadTestsFromTestCase(TestCodeGeneration))

    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print summary
    print("\n" + "=" * 70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print("=" * 70)

    return result.wasSuccessful()


if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)
