import 'package:flutter/material.dart';

import '../controllers/auth_controller.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({required this.controller, super.key});

  final AuthController controller;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final isBusy = widget.controller.status == AuthControllerStatus.signingIn;
    final error = widget.controller.error;
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Welcome to EcoLoop',
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Sign in to track your recycling and rewards.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                FilledButton.icon(
                  onPressed: isBusy ? null : widget.controller.signIn,
                  icon: isBusy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.login),
                  label: Text(
                    isBusy ? 'Signing in...' : 'Continue with Google',
                  ),
                ),
                if (widget.controller.status ==
                    AuthControllerStatus.cancelled) ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Sign-in was cancelled.',
                    textAlign: TextAlign.center,
                  ),
                ],
                if (error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    'Sign-in could not be completed. Please try again.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
