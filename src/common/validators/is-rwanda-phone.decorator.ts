import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidRwandaPhone } from '../utils/rwanda-phone.util';

@ValidatorConstraint({ name: 'isRwandaPhone', async: false })
export class IsRwandaPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || value === '') {
      return true; // use @IsOptional / @ValidateIf for required
    }
    if (typeof value !== 'string') {
      return false;
    }
    return isValidRwandaPhone(value);
  }

  defaultMessage(): string {
    return 'Phone must be a valid Rwanda mobile number (e.g. +250788123456 or 0788123456).';
  }
}

export function IsRwandaPhone(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRwandaPhoneConstraint,
    });
  };
}
